const TDLog = require('../models/TDLog');
const TDBooking = require('../models/TDBooking');
const DemoVehicle = require('../models/DemoVehicle');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const VehicleStatusLog = require('../models/VehicleStatusLog');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { notifyTDCompleted } = require('../utils/notifications');
const { checkDepletionAlerts } = require('../utils/depletionEngine');

exports.startTestDrive = asyncHandler(async (req, res) => {
  const { bookingId, openingOdometer, openingBattery, startPhotoUrl, customerOtpVerified } = req.body;

  if (openingOdometer == null || Number.isNaN(Number(openingOdometer))) {
    throw new ApiError(400, 'Opening odometer reading is required');
  }

  const booking = await TDBooking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!['CONFIRMED', 'PENDING'].includes(booking.bookingStatus)) {
    throw new ApiError(400, `Booking is ${booking.bookingStatus} — cannot start test drive`);
  }

  const existing = await TDLog.findOne({ bookingId, status: 'STARTED' });
  if (existing) throw new ApiError(409, 'Test drive already started for this booking');

  const log = await TDLog.create({
    bookingId,
    executiveId: req.admin._id,
    customerId: booking.customerId,
    vehicleId: booking.vehicleId,
    openingOdometer,
    openingBattery,
    startTime: new Date(),
    startPhotoUrl,
    customerOtpVerified: Boolean(customerOtpVerified),
    status: 'STARTED'
  });

  booking.bookingStatus = 'IN_PROGRESS';
  await booking.save();

  if (booking.vehicleId) {
    await DemoVehicle.findByIdAndUpdate(booking.vehicleId, { status: 'RUNNING', batteryPercent: openingBattery });
    await VehicleStatusLog.create({
      vehicleId: booking.vehicleId,
      fromStatus: 'BOOKED',
      toStatus: 'RUNNING',
      changedBy: req.admin._id,
      bookingId,
      reason: 'Test drive started'
    });
  }

  res.status(201).json({ success: true, data: log, message: 'Test drive started!' });
});

exports.endTestDrive = asyncHandler(async (req, res) => {
  const { logId } = req.params;
  const { closingOdometer, closingBattery, endPhotoUrl, damageNotes, executiveRemarks, customerSignatureUrl } = req.body;

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
  await log.save(); // totalKM and durationMinutes calculated by pre-save hook

  const booking = await TDBooking.findById(log.bookingId);
  if (booking) {
    booking.bookingStatus = 'COMPLETED';
    await booking.save();
  }

  // Update vehicle: available, new odometer + battery
  if (log.vehicleId) {
    const vehicle = await DemoVehicle.findById(log.vehicleId);
    if (vehicle) {
      vehicle.status = 'AVAILABLE';
      vehicle.currentOdometer = closingOdometer;
      vehicle.batteryPercent = closingBattery;
      vehicle.totalTestDriveKM = (vehicle.totalTestDriveKM || 0) + (log.totalKM || 0);
      vehicle.totalTestDrives = (vehicle.totalTestDrives || 0) + 1;
      await vehicle.save();
      await VehicleStatusLog.create({
        vehicleId: vehicle._id,
        fromStatus: 'RUNNING',
        toStatus: 'AVAILABLE',
        changedBy: req.admin._id,
        bookingId: log.bookingId,
        reason: 'Test drive completed'
      });
      // Run depletion checks
      checkDepletionAlerts(vehicle._id).catch(console.error);
    }
  }

  // CRM: Move lead to TEST_DRIVE_COMPLETED
  const customer = await Customer.findById(log.customerId);
  if (customer && customer.leadId) {
    const lead = await Lead.findById(customer.leadId);
    if (lead) {
      const prevStage = lead.status;
      lead.status = 'Test Drive Completed';
      lead.remarks = `Test Drive completed — ${log.totalKM} km driven in ${log.durationMinutes} min`;
      await lead.save();
      await LeadStageHistory.create({
        leadId: lead._id,
        bookingId: log.bookingId,
        fromStage: prevStage,
        toStage: 'Test Drive Completed',
        changedBy: req.admin._id,
        reason: `TD completed — ${log.totalKM}km`
      });
    }
  }

  // Notifications
  if (customer) {
    notifyTDCompleted(booking, customer).catch(console.error);
  }

  await log.populate([
    { path: 'bookingId', select: 'bookingId slotDate slotTime' },
    { path: 'vehicleId', select: 'vehicleId model registrationNo' },
    { path: 'customerId', select: 'name mobile' }
  ]);

  res.json({ success: true, data: log, message: `Test drive completed! ${log.totalKM}km in ${log.durationMinutes} min.` });
});

exports.getLogs = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.bookingId) query.bookingId = req.query.bookingId;
  if (req.query.vehicleId) query.vehicleId = req.query.vehicleId;
  if (req.query.executiveId) query.executiveId = req.query.executiveId;
  if (req.query.status) query.status = req.query.status;

  const logs = await TDLog.find(query)
    .populate('bookingId', 'bookingId slotDate slotTime')
    .populate('vehicleId', 'vehicleId model registrationNo')
    .populate('customerId', 'name mobile')
    .populate('executiveId', 'name')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, data: logs });
});

exports.getLogById = asyncHandler(async (req, res) => {
  const log = await TDLog.findById(req.params.id)
    .populate('bookingId')
    .populate('vehicleId')
    .populate('customerId')
    .populate('executiveId', 'name email');
  if (!log) throw new ApiError(404, 'Log not found');
  res.json({ success: true, data: log });
});

exports.updateGpsRoute = asyncHandler(async (req, res) => {
  const { logId } = req.params;
  const { points } = req.body;
  const log = await TDLog.findByIdAndUpdate(
    logId,
    { $push: { gpsRoute: { $each: points } } },
    { new: true }
  );
  if (!log) throw new ApiError(404, 'Log not found');
  res.json({ success: true, message: 'GPS route updated' });
});
