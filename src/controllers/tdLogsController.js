require('../models/tdModels');

const TDLog = require('../models/TDLog');
const TDBooking = require('../models/TDBooking');
const TDVehicle = require('../models/TDVehicle');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { syncLeadFromTDCompletion } = require('../utils/syncLeadFromTDCompletion');

function executiveIdFromReq(req) {
  return req.tdStaff?._id || req.admin?._id;
}

exports.listLogs = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.bookingId) query.bookingId = req.query.bookingId;
  if (req.query.vehicleId) query.vehicleId = req.query.vehicleId;
  if (req.query.executiveId) query.executiveId = req.query.executiveId;
  if (req.query.status) query.status = String(req.query.status).toUpperCase();

  const logs = await TDLog.find(query)
    .populate('bookingId', 'bookingId slotDate slotTime')
    .populate('vehicleId', 'vehicleId model registrationNo')
    .populate('customerId', 'name mobile')
    .populate('executiveId', 'name')
    .sort({ createdAt: -1 })
    .limit(100);

  return successResponse(res, logs);
});

exports.getLog = asyncHandler(async (req, res) => {
  const log = await TDLog.findById(req.params.id)
    .populate('bookingId')
    .populate('vehicleId')
    .populate('customerId')
    .populate('executiveId', 'name email');
  if (!log) throw new ApiError(404, 'Log not found');
  return successResponse(res, log);
});

exports.startTestDrive = asyncHandler(async (req, res) => {
  const { bookingId, openingOdometer, openingBattery, startPhotoUrl, customerOtpVerified } = req.body || {};

  if (openingOdometer == null || Number.isNaN(Number(openingOdometer))) {
    throw new ApiError(400, 'Opening odometer reading is required');
  }
  if (!bookingId) throw new ApiError(400, 'bookingId is required');

  const booking = await TDBooking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!['CONFIRMED', 'PENDING', 'RESCHEDULED'].includes(booking.bookingStatus)) {
    throw new ApiError(400, `Booking is ${booking.bookingStatus} — cannot start test drive`);
  }

  const existing = await TDLog.findOne({ bookingId, status: 'STARTED' });
  if (existing) throw new ApiError(409, 'Test drive already started for this booking');

  const log = await TDLog.create({
    bookingId,
    executiveId: executiveIdFromReq(req),
    customerId: booking.customerId,
    vehicleId: booking.vehicleId,
    openingOdometer,
    openingBattery,
    startTime: new Date(),
    startPhotoUrl,
    customerOtpVerified: Boolean(customerOtpVerified),
    status: 'STARTED',
  });

  booking.bookingStatus = 'IN_PROGRESS';
  await booking.save();

  if (booking.vehicleId) {
    await TDVehicle.findByIdAndUpdate(booking.vehicleId, {
      status: 'RUNNING',
      ...(openingBattery != null ? { batteryPercent: openingBattery } : {}),
    });
  }

  return successResponse(res, log, 'Test drive started', 201);
});

exports.endTestDrive = asyncHandler(async (req, res) => {
  const { logId } = req.params;
  const { closingOdometer, closingBattery, endPhotoUrl, damageNotes, executiveRemarks, customerSignatureUrl } =
    req.body || {};

  const log = await TDLog.findById(logId);
  if (!log) throw new ApiError(404, 'Test drive log not found');
  if (log.status !== 'STARTED') throw new ApiError(400, 'Test drive is not in progress');

  if (closingOdometer == null || Number.isNaN(Number(closingOdometer))) {
    throw new ApiError(400, 'Closing odometer reading is required');
  }
  if (log.openingOdometer != null && Number(closingOdometer) < log.openingOdometer) {
    throw new ApiError(400, 'Closing odometer cannot be less than opening odometer');
  }

  log.closingOdometer = closingOdometer;
  log.closingBattery = closingBattery;
  log.endTime = new Date();
  log.endPhotoUrl = endPhotoUrl;
  log.damageNotes = damageNotes;
  log.executiveRemarks = executiveRemarks;
  log.customerSignatureUrl = customerSignatureUrl;
  log.status = 'COMPLETED';
  await log.save();

  const booking = await TDBooking.findById(log.bookingId);
  if (booking) {
    booking.bookingStatus = 'COMPLETED';
    await booking.save();
  }

  if (log.vehicleId) {
    const vehicle = await TDVehicle.findById(log.vehicleId);
    if (vehicle) {
      vehicle.status = 'AVAILABLE';
      vehicle.currentOdometer = closingOdometer;
      if (closingBattery != null) vehicle.batteryPercent = closingBattery;
      vehicle.totalTestDriveKM = (vehicle.totalTestDriveKM || 0) + (log.totalKM || 0);
      vehicle.totalTestDrives = (vehicle.totalTestDrives || 0) + 1;
      await vehicle.save();
    }
  }

  await syncLeadFromTDCompletion({
    log,
    booking,
    changedBy: executiveIdFromReq(req),
  }).catch((err) => console.error('[syncLeadFromTDCompletion]', err));

  await log.populate([
    { path: 'bookingId', select: 'bookingId slotDate slotTime' },
    { path: 'vehicleId', select: 'vehicleId model registrationNo' },
    { path: 'customerId', select: 'name mobile' },
  ]);

  return successResponse(
    res,
    log,
    `Test drive completed${log.totalKM != null ? ` — ${log.totalKM} km` : ''}`,
  );
});

exports.updateGpsRoute = asyncHandler(async (req, res) => {
  const { logId } = req.params;
  const { points } = req.body || {};
  if (!Array.isArray(points) || !points.length) {
    throw new ApiError(400, 'points array is required');
  }

  const log = await TDLog.findByIdAndUpdate(
    logId,
    { $push: { gpsRoute: { $each: points } } },
    { new: true },
  );
  if (!log) throw new ApiError(404, 'Log not found');
  return successResponse(res, log, 'GPS route updated');
});
