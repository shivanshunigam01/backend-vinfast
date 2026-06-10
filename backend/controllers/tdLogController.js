const TDLog = require('../models/TDLog');
const TDBooking = require('../models/TDBooking');
const DemoVehicle = require('../models/DemoVehicle');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const VehicleStatusLog = require('../models/VehicleStatusLog');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// POST /executive/td/logs/start — start test drive
exports.startTestDrive = asyncHandler(async (req, res) => {
  const { bookingId, openingOdometer, openingBatteryPct, startLat, startLng, customerConfirmed, licenseChecked } = req.body;

  const booking = await TDBooking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.assignedExecutive?.toString() !== req.admin._id.toString()) {
    throw new ApiError(403, 'You are not assigned to this booking');
  }
  if (!['Assigned', 'Confirmed', 'Approved'].includes(booking.status)) {
    throw new ApiError(400, `Cannot start test drive in status: ${booking.status}`);
  }
  if (!customerConfirmed) throw new ApiError(400, 'Customer confirmation is required');
  if (!licenseChecked) throw new ApiError(400, 'Driving license check is required');
  if (openingOdometer === undefined) throw new ApiError(400, 'Opening odometer reading is required');
  if (openingBatteryPct === undefined) throw new ApiError(400, 'Opening battery level is required');

  const existing = await TDLog.findOne({ booking: bookingId });
  if (existing && existing.startedAt) throw new ApiError(400, 'Test drive already started');

  const now = new Date();
  const log = await TDLog.create({
    booking: booking._id,
    vehicle: booking.assignedVehicle,
    executive: req.admin._id,
    customer: booking.customer,
    customerConfirmed,
    licenseChecked,
    startedAt: now,
    openingOdometer: { capturedAt: now, capturedBy: req.admin._id, value: openingOdometer },
    openingBatteryPct: { capturedAt: now, capturedBy: req.admin._id, value: openingBatteryPct },
    ...(startLat && startLng && { startLocation: { lat: startLat, lng: startLng, capturedAt: now } })
  });

  // Update booking and vehicle status
  booking.status = 'In Progress';
  await booking.save();

  if (booking.assignedVehicle) {
    await DemoVehicle.findByIdAndUpdate(booking.assignedVehicle, { status: 'Running', currentExecutive: req.admin._id });
    await VehicleStatusLog.create({ vehicle: booking.assignedVehicle, fromStatus: 'Booked', toStatus: 'Running', changedBy: req.admin._id, reason: `TD Started: ${booking.bookingRef}`, relatedBooking: booking._id, odometerAtChange: openingOdometer, batteryPctAtChange: openingBatteryPct });
  }

  res.status(201).json({ success: true, message: 'Test drive started!', data: log });
});

// PUT /executive/td/logs/:id/track — append GPS point
exports.addGpsPoint = asyncHandler(async (req, res) => {
  const { lat, lng, speedKmh } = req.body;
  const log = await TDLog.findById(req.params.id);
  if (!log) throw new ApiError(404, 'TD Log not found');
  if (log.executive.toString() !== req.admin._id.toString()) throw new ApiError(403, 'Access denied');

  log.routePoints.push({ lat, lng, capturedAt: new Date() });
  if (speedKmh && speedKmh > (log.maxSpeedKmh || 0)) log.maxSpeedKmh = speedKmh;
  await log.save();

  res.json({ success: true, message: 'GPS point added' });
});

// PUT /executive/td/logs/:id/complete — complete test drive
exports.completeTestDrive = asyncHandler(async (req, res) => {
  const {
    closingOdometer, closingBatteryPct, endLat, endLng,
    executiveRemarks, customerMood, buyingIntent,
    nextFollowUpDate, leadStageUpdatedTo
  } = req.body;

  if (closingOdometer === undefined) throw new ApiError(400, 'Closing odometer is required');
  if (closingBatteryPct === undefined) throw new ApiError(400, 'Closing battery level is required');

  const log = await TDLog.findById(req.params.id);
  if (!log) throw new ApiError(404, 'TD Log not found');
  if (log.executive.toString() !== req.admin._id.toString()) throw new ApiError(403, 'Access denied');
  if (log.completedAt) throw new ApiError(400, 'Test drive already completed');

  const now = new Date();
  log.completedAt = now;
  log.durationMins = Math.round((now - log.startedAt) / 60000);

  log.closingOdometer = { capturedAt: now, capturedBy: req.admin._id, value: closingOdometer };
  log.closingBatteryPct = { capturedAt: now, capturedBy: req.admin._id, value: closingBatteryPct };
  log.distanceDriven = Math.max(0, closingOdometer - (log.openingOdometer?.value || closingOdometer));
  log.batteryUsedPct = Math.max(0, (log.openingBatteryPct?.value || closingBatteryPct) - closingBatteryPct);

  if (endLat && endLng) log.endLocation = { lat: endLat, lng: endLng, capturedAt: now };

  log.executiveRemarks = executiveRemarks;
  log.customerMood = customerMood;
  log.buyingIntent = buyingIntent;
  log.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : undefined;

  await log.save();

  // Update booking
  const booking = await TDBooking.findByIdAndUpdate(log.booking, { status: 'Completed' }, { new: true });

  // Update vehicle
  if (log.vehicle) {
    const vehicle = await DemoVehicle.findById(log.vehicle);
    if (vehicle) {
      const kmAdded = log.distanceDriven || 0;
      vehicle.status = closingBatteryPct <= vehicle.batteryLowThreshold ? 'Battery Low' : 'Available';
      vehicle.batteryPercentage = closingBatteryPct;
      vehicle.currentOdometer = closingOdometer;
      vehicle.totalKmDriven += kmAdded;
      vehicle.dailyKm += kmAdded;
      vehicle.monthlyKm += kmAdded;
      vehicle.totalTestDrives += 1;
      vehicle.currentExecutive = undefined;
      if (vehicle.totalKmDriven >= vehicle.depletionThresholdKm) vehicle.replacementRecommended = true;
      await vehicle.save();
      await VehicleStatusLog.create({ vehicle: vehicle._id, fromStatus: 'Running', toStatus: vehicle.status, changedBy: req.admin._id, reason: 'TD Completed', relatedBooking: log.booking, odometerAtChange: closingOdometer, batteryPctAtChange: closingBatteryPct });
    }
  }

  // CRM lead stage update
  if (leadStageUpdatedTo && booking?.leadId) {
    const lead = await Lead.findById(booking.leadId);
    if (lead) {
      const fromStage = lead.status;
      lead.status = leadStageUpdatedTo;
      if (nextFollowUpDate) lead.nextFollowUp = new Date(nextFollowUpDate);
      await lead.save();
      log.leadStageUpdatedTo = leadStageUpdatedTo;
      log.leadStageUpdatedAt = now;
      await log.save();
      await LeadStageHistory.create({ lead: lead._id, fromStage, toStage: leadStageUpdatedTo, changedBy: req.admin._id, changedByType: 'Executive', relatedBooking: log.booking, relatedTDLog: log._id });
    }
  }

  res.json({ success: true, message: 'Test drive completed successfully!', data: log });
});

// GET /executive/td/logs/booking/:bookingId
exports.getLogByBooking = asyncHandler(async (req, res) => {
  const log = await TDLog.findOne({ booking: req.params.bookingId })
    .populate('vehicle', 'vehicleId model registrationNumber')
    .populate('executive', 'name email')
    .populate('customer', 'customerId name mobile');
  if (!log) throw new ApiError(404, 'TD Log not found');
  res.json({ success: true, data: log });
});
