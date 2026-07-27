require('../models/tdModels');

const TDLog = require('../models/TDLog');
const TDBooking = require('../models/TDBooking');
const TDVehicle = require('../models/TDVehicle');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { syncLeadFromTDCompletion } = require('../utils/syncLeadFromTDCompletion');
const { cloudinaryConfigured, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

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
  if (booking.approvalStatus === 'PENDING') {
    throw new ApiError(403, 'This repeat test drive is awaiting admin approval — it cannot be started yet');
  }
  if (booking.approvalStatus === 'REJECTED') {
    throw new ApiError(403, 'This repeat test drive request was rejected by admin');
  }
  if (!booking.dlVerified || !booking.dlImageUrl) {
    throw new ApiError(
      400,
      'Driving licence must be uploaded and verified before starting the test drive',
    );
  }
  if (booking.assignmentStatus === 'PENDING_ACCEPTANCE') {
    throw new ApiError(400, 'Accept the assignment before starting the test drive');
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
  const {
    closingOdometer,
    closingBattery,
    endPhotoUrl,
    damageNotes,
    executiveRemarks,
    customerSignatureUrl,
    endLat,
    endLng,
    endAccuracy,
  } = req.body || {};

  const log = await TDLog.findById(logId);
  if (!log) throw new ApiError(404, 'Test drive log not found');
  if (log.status !== 'STARTED') throw new ApiError(400, 'Test drive is not in progress');

  // Multipart bodies deliver every field as a string; normalize the numerics.
  if (closingOdometer == null || closingOdometer === '' || Number.isNaN(Number(closingOdometer))) {
    throw new ApiError(400, 'Closing odometer reading is required');
  }
  if (log.openingOdometer != null && Number(closingOdometer) < log.openingOdometer) {
    throw new ApiError(400, 'Closing odometer cannot be less than opening odometer');
  }
  const battery =
    closingBattery !== undefined && closingBattery !== '' && !Number.isNaN(Number(closingBattery))
      ? Number(closingBattery)
      : undefined;

  const booking = await TDBooking.findById(log.bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found for this test drive log');

  // Completion requirements: verified driving licence and a customer photo.
  if (!booking.dlVerified || !booking.dlImageUrl) {
    throw new ApiError(400, "Verify the customer's driving licence before completing the test drive");
  }
  const customerPhotoFile = req.files?.customerPhoto?.[0];
  const vehiclePhotoFile = req.files?.vehiclePhoto?.[0];
  if (!customerPhotoFile && !log.customerPhotoUrl) {
    throw new ApiError(400, 'Customer photo is required to complete the test drive');
  }
  if ((customerPhotoFile || vehiclePhotoFile) && !cloudinaryConfigured()) {
    throw new ApiError(503, 'Image storage is not configured on the server');
  }

  if (customerPhotoFile) {
    const uploaded = await uploadBufferToCloudinary(customerPhotoFile.buffer, {
      folder: 'patliputra-vinfast/td-completion',
      public_id: `td-customer-${booking.bookingId || log._id}-${Date.now()}`,
    });
    log.customerPhotoUrl = uploaded.secure_url;
    log.customerPhotoPublicId = uploaded.public_id;
  }
  if (vehiclePhotoFile) {
    const uploaded = await uploadBufferToCloudinary(vehiclePhotoFile.buffer, {
      folder: 'patliputra-vinfast/td-completion',
      public_id: `td-vehicle-${booking.bookingId || log._id}-${Date.now()}`,
    });
    log.vehiclePhotoUrl = uploaded.secure_url;
    log.vehiclePhotoPublicId = uploaded.public_id;
  }

  // Completion geolocation (sent by the executive's device).
  const lat = Number(endLat);
  const lng = Number(endLng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    log.endLocation = {
      lat,
      lng,
      accuracy: Number.isFinite(Number(endAccuracy)) ? Number(endAccuracy) : undefined,
      capturedAt: new Date(),
    };
    log.gpsRoute.push({ lat, lng, timestamp: new Date() });
  }

  // Snapshot the driving licence data onto the completion record.
  log.dlNumber = booking.dlNumber || undefined;
  log.dlValidUntil = booking.dlValidUntil || undefined;
  log.dlImageUrl = booking.dlImageUrl || undefined;

  log.closingOdometer = Number(closingOdometer);
  if (battery !== undefined) log.closingBattery = battery;
  log.endTime = new Date();
  if (endPhotoUrl) log.endPhotoUrl = endPhotoUrl;
  if (damageNotes !== undefined) log.damageNotes = damageNotes;
  if (executiveRemarks !== undefined) log.executiveRemarks = executiveRemarks;
  if (customerSignatureUrl) log.customerSignatureUrl = customerSignatureUrl;
  log.status = 'COMPLETED';
  await log.save();

  booking.bookingStatus = 'COMPLETED';
  await booking.save();

  if (log.vehicleId) {
    const vehicle = await TDVehicle.findById(log.vehicleId);
    if (vehicle) {
      vehicle.status = 'AVAILABLE';
      vehicle.currentOdometer = Number(closingOdometer);
      if (battery !== undefined) vehicle.batteryPercent = battery;
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
