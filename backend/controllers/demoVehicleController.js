const DemoVehicle = require('../models/DemoVehicle');
const VehicleStatusLog = require('../models/VehicleStatusLog');
const ChargingLog = require('../models/ChargingLog');
const RepairLog = require('../models/RepairLog');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

const NON_BOOKABLE = ['Booked', 'Running', 'Charging', 'Under Repair', 'Battery Low'];

// GET /admin/td/vehicles
exports.getVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = { active: true };
  if (req.query.status) query.status = req.query.status;
  if (req.query.model) query.model = req.query.model;
  if (req.query.branch) query.assignedBranch = req.query.branch;

  const [docs, total] = await Promise.all([
    DemoVehicle.find(query)
      .populate('assignedBranch', 'name code city')
      .populate('currentExecutive', 'name email')
      .sort({ status: 1, createdAt: -1 })
      .skip(skip).limit(limit),
    DemoVehicle.countDocuments(query)
  ]);
  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

// GET /admin/td/vehicles/:id
exports.getVehicleById = asyncHandler(async (req, res) => {
  const doc = await DemoVehicle.findById(req.params.id)
    .populate('assignedBranch', 'name code city')
    .populate('currentExecutive', 'name email');
  if (!doc) throw new ApiError(404, 'Vehicle not found');
  res.json({ success: true, data: doc });
});

// POST /admin/td/vehicles
exports.createVehicle = asyncHandler(async (req, res) => {
  const doc = await DemoVehicle.create(req.body);
  res.status(201).json({ success: true, data: doc });
});

// PUT /admin/td/vehicles/:id
exports.updateVehicle = asyncHandler(async (req, res) => {
  const doc = await DemoVehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('assignedBranch', 'name code');
  if (!doc) throw new ApiError(404, 'Vehicle not found');
  res.json({ success: true, data: doc });
});

// DELETE /admin/td/vehicles/:id
exports.deleteVehicle = asyncHandler(async (req, res) => {
  const doc = await DemoVehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vehicle not found');
  doc.active = false;
  await doc.save();
  res.json({ success: true, message: 'Vehicle deactivated' });
});

// PUT /admin/td/vehicles/:id/status
exports.updateVehicleStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const doc = await DemoVehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vehicle not found');

  const fromStatus = doc.status;
  doc.status = status;
  if (status === 'Under Repair') doc.underRepair = true;
  if (status === 'Available') { doc.underRepair = false; doc.repairStartAt = undefined; }
  await doc.save();

  await VehicleStatusLog.create({
    vehicle: doc._id, fromStatus, toStatus: status,
    changedBy: req.admin._id, reason,
    batteryPctAtChange: doc.batteryPercentage,
    odometerAtChange: doc.currentOdometer
  });

  res.json({ success: true, data: doc });
});

// POST /admin/td/vehicles/:id/charging/start
exports.startCharging = asyncHandler(async (req, res) => {
  const { chargerType, chargerLocation } = req.body;
  const doc = await DemoVehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vehicle not found');
  if (doc.status === 'Running' || doc.status === 'Booked') {
    throw new ApiError(400, `Cannot start charging while vehicle is ${doc.status}`);
  }

  const fromStatus = doc.status;
  doc.status = 'Charging';
  doc.chargingStatus = 'Charging';
  const estimatedMins = Math.ceil((100 - doc.batteryPercentage) * 1.5);
  doc.estimatedChargingCompleteAt = new Date(Date.now() + estimatedMins * 60000);
  await doc.save();

  const log = await ChargingLog.create({
    vehicle: doc._id, startedAt: new Date(),
    startingBatteryPct: doc.batteryPercentage,
    chargerType, chargerLocation, initiatedBy: req.admin._id
  });

  await VehicleStatusLog.create({ vehicle: doc._id, fromStatus, toStatus: 'Charging', changedBy: req.admin._id, reason: 'Charging started' });

  res.json({ success: true, message: `Charging started. ETA: ${estimatedMins} mins`, data: { vehicle: doc, chargingLog: log } });
});

// POST /admin/td/vehicles/:id/charging/complete
exports.completeCharging = asyncHandler(async (req, res) => {
  const { endingBatteryPct, energyConsumedKwh } = req.body;
  const doc = await DemoVehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vehicle not found');
  if (doc.status !== 'Charging') throw new ApiError(400, 'Vehicle is not currently charging');

  const log = await ChargingLog.findOne({ vehicle: doc._id, completedAt: null }).sort({ createdAt: -1 });

  const pct = endingBatteryPct ?? 100;
  doc.batteryPercentage = pct;
  doc.chargingStatus = 'Full';
  doc.status = pct <= doc.batteryLowThreshold ? 'Battery Low' : 'Available';
  doc.lastChargedAt = new Date();
  doc.totalChargingCycles += 1;
  doc.estimatedChargingCompleteAt = undefined;
  await doc.save();

  if (log) {
    log.completedAt = new Date();
    log.endingBatteryPct = pct;
    log.energyConsumedKwh = energyConsumedKwh;
    log.durationMins = Math.round((new Date() - log.startedAt) / 60000);
    await log.save();
  }

  await VehicleStatusLog.create({ vehicle: doc._id, fromStatus: 'Charging', toStatus: doc.status, changedBy: req.admin._id, reason: 'Charging completed' });

  res.json({ success: true, message: 'Charging completed', data: doc });
});

// POST /admin/td/vehicles/:id/repair/start
exports.startRepair = asyncHandler(async (req, res) => {
  const { repairType, description, estimatedCompletionAt, serviceCenter, technician } = req.body;
  const doc = await DemoVehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vehicle not found');

  const fromStatus = doc.status;
  doc.status = 'Under Repair';
  doc.underRepair = true;
  doc.repairStartAt = new Date();
  doc.estimatedRepairCompleteAt = estimatedCompletionAt ? new Date(estimatedCompletionAt) : undefined;
  await doc.save();

  const log = await RepairLog.create({
    vehicle: doc._id, repairType, description,
    repairStartAt: new Date(), estimatedCompletionAt,
    serviceCenter, technician,
    odometerAtRepair: doc.currentOdometer,
    loggedBy: req.admin._id, status: 'In Progress'
  });

  await VehicleStatusLog.create({ vehicle: doc._id, fromStatus, toStatus: 'Under Repair', changedBy: req.admin._id, reason: `Repair: ${repairType}` });

  res.status(201).json({ success: true, message: 'Repair logged', data: { vehicle: doc, repairLog: log } });
});

// POST /admin/td/vehicles/:id/repair/complete
exports.completeRepair = asyncHandler(async (req, res) => {
  const { notes, cost } = req.body;
  const doc = await DemoVehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vehicle not found');

  const log = await RepairLog.findOne({ vehicle: doc._id, status: 'In Progress' }).sort({ createdAt: -1 });

  doc.status = 'Available';
  doc.underRepair = false;
  doc.lastServiceAt = new Date();
  doc.estimatedRepairCompleteAt = undefined;
  await doc.save();

  if (log) {
    log.status = 'Completed';
    log.actualCompletionAt = new Date();
    log.resolvedBy = req.admin._id;
    if (notes) log.notes = notes;
    if (cost !== undefined) log.cost = cost;
    await log.save();
  }

  await VehicleStatusLog.create({ vehicle: doc._id, fromStatus: 'Under Repair', toStatus: 'Available', changedBy: req.admin._id, reason: 'Repair completed' });

  res.json({ success: true, message: 'Repair completed, vehicle available', data: doc });
});

// GET /admin/td/vehicles/:id/history
exports.getVehicleHistory = asyncHandler(async (req, res) => {
  const [statusLogs, chargingLogs, repairLogs] = await Promise.all([
    VehicleStatusLog.find({ vehicle: req.params.id }).populate('changedBy', 'name').sort({ createdAt: -1 }).limit(30),
    ChargingLog.find({ vehicle: req.params.id }).sort({ createdAt: -1 }).limit(20),
    RepairLog.find({ vehicle: req.params.id }).sort({ createdAt: -1 }).limit(20)
  ]);
  res.json({ success: true, data: { statusLogs, chargingLogs, repairLogs } });
});

// GET /public/td/vehicles/available
exports.getAvailableVehicles = asyncHandler(async (req, res) => {
  const { model, branch } = req.query;
  const query = { active: true, status: 'Available' };
  if (model) query.model = model;
  if (branch) query.assignedBranch = branch;

  const docs = await DemoVehicle.find(query)
    .select('vehicleId model variant color batteryPercentage assignedBranch status')
    .populate('assignedBranch', 'name city');
  res.json({ success: true, data: docs });
});
