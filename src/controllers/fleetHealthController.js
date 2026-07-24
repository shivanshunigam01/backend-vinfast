require('../models/tdModels');

const TDVehicle = require('../models/TDVehicle');
const ChargingLog = require('../models/ChargingLog');
const RepairLog = require('../models/RepairLog');
const TDBooking = require('../models/TDBooking');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { isoDateOnly } = require('../utils/tdSlotUtils');

/**
 * Test Drive Coordinator dashboard: charging, maintenance, readiness.
 */
exports.getFleetHealth = asyncHandler(async (req, res) => {
  const vehicles = await TDVehicle.find({}).sort({ model: 1, registrationNo: 1 }).limit(200);
  const vehicleIds = vehicles.map((v) => v._id);

  const [charging, repairs, upcomingBookings] = await Promise.all([
    ChargingLog.find({ vehicleId: { $in: vehicleIds } })
      .sort({ scheduledAt: -1 })
      .limit(200),
    RepairLog.find({ vehicleId: { $in: vehicleIds } })
      .sort({ dueDate: 1 })
      .limit(200),
    TDBooking.find({
      vehicleId: { $in: vehicleIds },
      bookingStatus: { $in: ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS'] },
      slotDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    })
      .select('vehicleId bookingId slotDate slotTime bookingStatus')
      .limit(200),
  ]);

  const chargingByVehicle = new Map();
  for (const c of charging) {
    const key = String(c.vehicleId);
    if (!chargingByVehicle.has(key)) chargingByVehicle.set(key, []);
    chargingByVehicle.get(key).push(c);
  }
  const repairByVehicle = new Map();
  for (const r of repairs) {
    const key = String(r.vehicleId);
    if (!repairByVehicle.has(key)) repairByVehicle.set(key, []);
    repairByVehicle.get(key).push(r);
  }
  const bookingByVehicle = new Map();
  for (const b of upcomingBookings) {
    const key = String(b.vehicleId);
    if (!bookingByVehicle.has(key)) bookingByVehicle.set(key, []);
    bookingByVehicle.get(key).push(b);
  }

  const rows = vehicles.map((v) => {
    const key = String(v._id);
    const charges = chargingByVehicle.get(key) || [];
    const maint = repairByVehicle.get(key) || [];
    const books = bookingByVehicle.get(key) || [];
    const latestCharge = charges[0] || null;
    const openMaint = maint.filter((m) => ['DUE', 'IN_PROGRESS', 'OVERDUE'].includes(m.status));
    const battery =
      latestCharge?.batteryAfter ??
      latestCharge?.batteryBefore ??
      v.batteryPercent ??
      v.soc ??
      null;

    const ready =
      ['AVAILABLE', 'BOOKED'].includes(v.status) &&
      openMaint.length === 0 &&
      (battery == null || battery >= 40);

    return {
      _id: v._id,
      vehicleId: v.vehicleId,
      model: v.model,
      registrationNo: v.registrationNo,
      color: v.color,
      status: v.status,
      batteryPercent: battery,
      chargingStatus: latestCharge?.status || 'UNKNOWN',
      nextChargeAt: latestCharge?.scheduledAt || null,
      maintenanceDue: openMaint[0]?.dueDate || null,
      openMaintenanceCount: openMaint.length,
      serviceHistoryCount: maint.filter((m) => m.status === 'COMPLETED').length,
      upcomingTestDrives: books.map((b) => ({
        bookingId: b.bookingId,
        date: isoDateOnly(b.slotDate),
        time: b.slotTime,
        status: b.bookingStatus,
      })),
      testDriveReadiness: ready ? 'READY' : 'NOT_READY',
      availability: v.status,
    };
  });

  return successResponse(res, rows);
});

exports.listChargingLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};
  if (req.query.vehicleId) query.vehicleId = req.query.vehicleId;
  const [docs, total] = await Promise.all([
    ChargingLog.find(query)
      .populate('vehicleId', 'vehicleId model registrationNo')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(limit),
    ChargingLog.countDocuments(query),
  ]);
  return successResponse(res, docs, undefined, 200, { page, limit, total });
});

exports.createChargingLog = asyncHandler(async (req, res) => {
  const { vehicleId, scheduledAt, batteryBefore, notes } = req.body || {};
  if (!vehicleId || !scheduledAt) throw new ApiError(400, 'vehicleId and scheduledAt are required');
  const vehicle = await TDVehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const log = await ChargingLog.create({
    vehicleId,
    scheduledAt: new Date(scheduledAt),
    batteryBefore,
    notes,
    status: 'SCHEDULED',
    createdBy: req.tdStaff?._id || req.admin?._id,
  });
  return successResponse(res, log, 'Charging scheduled', 201);
});

exports.updateChargingLog = asyncHandler(async (req, res) => {
  const log = await ChargingLog.findById(req.params.id);
  if (!log) throw new ApiError(404, 'Charging log not found');
  const { status, batteryAfter, batteryBefore, startedAt, completedAt, notes } = req.body || {};
  if (status) log.status = String(status).toUpperCase();
  if (batteryAfter !== undefined) log.batteryAfter = batteryAfter;
  if (batteryBefore !== undefined) log.batteryBefore = batteryBefore;
  if (startedAt) log.startedAt = new Date(startedAt);
  if (completedAt) log.completedAt = new Date(completedAt);
  if (notes !== undefined) log.notes = notes;
  if (log.status === 'IN_PROGRESS' && !log.startedAt) log.startedAt = new Date();
  if (log.status === 'COMPLETED' && !log.completedAt) log.completedAt = new Date();
  await log.save();
  return successResponse(res, log, 'Charging log updated');
});

exports.createRepairLog = asyncHandler(async (req, res) => {
  const { vehicleId, type, dueDate, description, cost } = req.body || {};
  if (!vehicleId) throw new ApiError(400, 'vehicleId is required');
  const vehicle = await TDVehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const log = await RepairLog.create({
    vehicleId,
    type: type || 'MAINTENANCE',
    dueDate: dueDate ? new Date(dueDate) : undefined,
    description,
    cost,
    status: 'DUE',
    createdBy: req.tdStaff?._id || req.admin?._id,
  });
  return successResponse(res, log, 'Maintenance record created', 201);
});

exports.updateRepairLog = asyncHandler(async (req, res) => {
  const log = await RepairLog.findById(req.params.id);
  if (!log) throw new ApiError(404, 'Repair log not found');
  const { status, description, cost, completedAt, dueDate, type } = req.body || {};
  if (status) log.status = String(status).toUpperCase();
  if (description !== undefined) log.description = description;
  if (cost !== undefined) log.cost = cost;
  if (type) log.type = type;
  if (dueDate) log.dueDate = new Date(dueDate);
  if (completedAt) log.completedAt = new Date(completedAt);
  if (log.status === 'COMPLETED' && !log.completedAt) log.completedAt = new Date();
  await log.save();
  return successResponse(res, log, 'Maintenance record updated');
});
