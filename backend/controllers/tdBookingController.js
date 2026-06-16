const TDBooking = require('../models/TDBooking');
const Customer = require('../models/Customer');
const DrivingLicense = require('../models/DrivingLicense');
const DemoVehicle = require('../models/DemoVehicle');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');
const { lockVehicle, confirmVehicleLock } = require('../utils/vehicleLock');
const { isSlotAvailable } = require('../utils/slotEngine');
const { autoAssignExecutive } = require('../utils/executiveAssignment');
const { notifyBookingConfirmed } = require('../utils/notifications');
const TDSlotConfig = require('../models/TDSlotConfig');
const TestDrive = require('../models/TestDrive');
const Admin = require('../models/Admin');
const { syncUnlinkedTestDrives } = require('../utils/syncTestDriveBooking');
const { syncLeadFromTDBooking } = require('../utils/syncLeadFromTDBooking');
const { normalizeTimeTo24h, toLocalMidnight, calendarDateBounds } = require('../utils/timeFormat');
const {
  isManagerRole,
  assertBookingAccess,
  pickStaffBookingUpdates
} = require('../utils/bookingAccess');

const BOOKING_TO_TESTDRIVE_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  MISSED: 'Cancelled'
};

exports.createBooking = asyncHandler(async (req, res) => {
  const { customerId, vehicleId, branchId, slotDate, slotTime, preferredModel } = req.body;

  const customer = await Customer.findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found');

  // DL validation
  const dl = await DrivingLicense.findOne({ customerId }).sort({ createdAt: -1 });
  if (!dl) throw new ApiError(400, 'Customer must upload a valid Driving License before booking');
  if (dl.verificationStatus === 'REJECTED') throw new ApiError(400, 'Booking blocked: Driving License is expired or rejected');

  // Slot availability
  const config = await TDSlotConfig.findOne({ branchId, active: true });
  const maxConcurrent = config ? config.maxConcurrentBookings : 2;
  const slotOk = await isSlotAvailable(branchId, slotDate, slotTime, maxConcurrent);
  if (!slotOk) throw new ApiError(409, 'This slot is fully booked. Please choose another time.');

  // Vehicle lock (optional — customer may not have chosen a vehicle yet)
  let vehicle = null;
  if (vehicleId) {
    const lockResult = await lockVehicle(vehicleId, req.admin?._id);
    if (!lockResult.success) throw new ApiError(409, lockResult.message);
    vehicle = await DemoVehicle.findById(vehicleId);
  }

  // Auto-assign executive
  const executive = await autoAssignExecutive(branchId, slotDate, slotTime);

  const booking = await TDBooking.create({
    customerId,
    vehicleId: vehicle ? vehicle._id : undefined,
    branchId,
    assignedExecutive: executive ? executive._id : undefined,
    slotDate: toLocalMidnight(slotDate) || new Date(slotDate),
    slotTime: normalizeTimeTo24h(slotTime) || slotTime,
    preferredModel,
    dlVerified: dl.verificationStatus === 'VERIFIED',
    bookingStatus: 'CONFIRMED',
    confirmationSentAt: new Date()
  });

  // Confirm vehicle lock → BOOKED
  if (vehicle) {
    await confirmVehicleLock(vehicle._id, booking._id, req.admin?._id);
  }

  // CRM: Update Lead stage if leadId exists
  if (customer.leadId) {
    const lead = await Lead.findById(customer.leadId);
    if (lead) {
      const prevStage = lead.status;
      lead.status = 'Booked';
      lead.remarks = `Test Drive booked — ${booking.bookingId}`;
      await lead.save();
      await LeadStageHistory.create({
        leadId: lead._id,
        bookingId: booking._id,
        fromStage: prevStage,
        toStage: 'TEST_DRIVE_BOOKED',
        reason: `Booking ${booking.bookingId} created`
      });
    }
  }

  // Notifications (fire and forget)
  notifyBookingConfirmed(booking, customer, executive).catch(console.error);

  await booking.populate([
    { path: 'customerId', select: 'name mobile customerId' },
    { path: 'vehicleId', select: 'vehicleId model variant registrationNo' },
    { path: 'assignedExecutive', select: 'name email' },
    { path: 'branchId', select: 'name code' }
  ]);

  res.status(201).json({ success: true, data: booking, message: 'Test Drive booked successfully!' });
});

exports.getBookings = asyncHandler(async (req, res) => {
  await syncUnlinkedTestDrives().catch((err) => {
    console.error('[getBookings] TD sync backfill failed:', err.message);
  });

  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.admin.role === 'executive') {
    query.assignedExecutive = req.admin._id;
  }
  if (req.query.branchId) query.branchId = req.query.branchId;
  if (req.query.status) query.bookingStatus = req.query.status;
  if (req.query.executiveId) query.assignedExecutive = req.query.executiveId;
  if (req.query.customerId) query.customerId = req.query.customerId;
  if (req.query.date) {
    const bounds = calendarDateBounds(req.query.date);
    if (bounds) {
      query.slotDate = { $gte: bounds.startOfDay, $lte: bounds.endOfDay };
    }
  }
  if (req.query.from || req.query.to) {
    query.slotDate = {};
    if (req.query.from) query.slotDate.$gte = new Date(req.query.from);
    if (req.query.to) query.slotDate.$lte = new Date(req.query.to);
  }

  const [docs, total] = await Promise.all([
    TDBooking.find(query)
      .populate('customerId', 'name mobile customerId email city')
      .populate('vehicleId', 'vehicleId model registrationNo color')
      .populate('assignedExecutive', 'name email')
      .populate('branchId', '_id name code')
      .populate('testDriveId', 'customerName mobile email city model variant preferredTestDriveLocation ownsCar currentCarDetails purchaseTimeline remarks status')
      .sort({ slotDate: -1, slotTime: -1 })
      .skip(skip).limit(limit),
    TDBooking.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getBookingById = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findById(req.params.id)
    .populate('customerId', 'name mobile email customerId city address')
    .populate('vehicleId', 'vehicleId model variant registrationNo batteryPercent color currentOdometer')
    .populate('assignedExecutive', 'name email role designation')
    .populate('branchId', '_id name code address')
    .populate('testDriveId');
  assertBookingAccess(booking, req.admin);
  res.json({ success: true, data: booking });
});

const { fetchAssignableStaff } = require('./tdStaffController');

exports.listExecutives = asyncHandler(async (_req, res) => {
  const data = await fetchAssignableStaff();
  res.json({ success: true, data });
});

exports.updateBooking = asyncHandler(async (req, res) => {
  const existing = await TDBooking.findById(req.params.id);
  assertBookingAccess(existing, req.admin);

  const updates = isManagerRole(req.admin)
    ? { ...req.body }
    : pickStaffBookingUpdates(req.body);

  if (!Object.keys(updates).length) {
    throw new ApiError(400, 'No allowed fields to update');
  }

  if (updates.slotTime) updates.slotTime = normalizeTimeTo24h(updates.slotTime) || updates.slotTime;
  if (updates.slotDate) updates.slotDate = toLocalMidnight(updates.slotDate) || new Date(updates.slotDate);

  const booking = await TDBooking.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('customerId', 'name mobile email city customerId')
    .populate('assignedExecutive', 'name email')
    .populate('branchId', 'name code')
    .populate('testDriveId');

  if (!booking) throw new ApiError(404, 'Booking not found');

  if (booking.testDriveId && updates.bookingStatus) {
    const tdStatus = BOOKING_TO_TESTDRIVE_STATUS[updates.bookingStatus];
    if (tdStatus) {
      await TestDrive.findByIdAndUpdate(booking.testDriveId._id || booking.testDriveId, { status: tdStatus });
    }
  }

  res.json({ success: true, data: booking });
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findById(req.params.id).populate('vehicleId');
  assertBookingAccess(booking, req.admin);
  if (['COMPLETED', 'CANCELLED'].includes(booking.bookingStatus)) {
    throw new ApiError(400, `Cannot cancel a booking that is ${booking.bookingStatus}`);
  }

  booking.bookingStatus = 'CANCELLED';
  booking.cancellationReason = req.body.reason || '';
  await booking.save();

  if (booking.testDriveId) {
    await TestDrive.findByIdAndUpdate(booking.testDriveId, { status: 'Cancelled' });
  }

  // Release vehicle if booked
  if (booking.vehicleId && booking.vehicleId.status === 'BOOKED') {
    booking.vehicleId.status = 'AVAILABLE';
    await booking.vehicleId.save();
  }

  res.json({ success: true, message: 'Booking cancelled', data: booking });
});

exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const { slotDate, slotTime } = req.body;
  const booking = await TDBooking.findById(req.params.id).populate('testDriveId', 'variant');
  assertBookingAccess(booking, req.admin);
  if (booking.bookingStatus === 'COMPLETED') throw new ApiError(400, 'Cannot reschedule a completed booking');

  const slotOk = await isSlotAvailable(
    booking.branchId,
    slotDate,
    slotTime,
    2,
    booking._id,
    booking.preferredModel || null,
    booking.preferredVariant || booking.testDriveId?.variant || null
  );
  if (!slotOk) throw new ApiError(409, 'New slot is not available. Please choose another time.');

  booking.slotDate = toLocalMidnight(slotDate) || new Date(slotDate);
  booking.slotTime = normalizeTimeTo24h(slotTime) || slotTime;
  booking.bookingStatus = 'RESCHEDULED';
  booking.rescheduleCount += 1;
  await booking.save();

  res.json({ success: true, data: booking, message: 'Booking rescheduled successfully' });
});

exports.assignExecutive = asyncHandler(async (req, res) => {
  const { executiveId } = req.body;
  const booking = await TDBooking.findByIdAndUpdate(
    req.params.id,
    { assignedExecutive: executiveId },
    { new: true }
  ).populate('assignedExecutive', 'name email');
  if (!booking) throw new ApiError(404, 'Booking not found');
  await syncLeadFromTDBooking(booking, { changedBy: req.admin._id }).catch((err) => {
    console.error('[assignExecutive] Lead sync failed:', err.message);
  });
  res.json({ success: true, data: booking, message: 'Executive assigned' });
});

exports.assignVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.body;
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  assertBookingAccess(booking, req.admin);

  if (['COMPLETED', 'CANCELLED'].includes(booking.bookingStatus)) {
    throw new ApiError(400, `Cannot change vehicle on a ${booking.bookingStatus} booking`);
  }

  if (booking.vehicleId) {
    const previous = await DemoVehicle.findById(booking.vehicleId);
    if (previous && ['BOOKED', 'AVAILABLE'].includes(previous.status)) {
      previous.status = 'AVAILABLE';
      await previous.save();
    }
  }

  if (vehicleId) {
    const vehicle = await DemoVehicle.findById(vehicleId);
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    if (!vehicle.active) throw new ApiError(400, 'Vehicle is not active');
    if (booking.preferredModel && vehicle.model !== booking.preferredModel) {
      throw new ApiError(400, `This booking is for ${booking.preferredModel}. Selected vehicle is ${vehicle.model}.`);
    }
    if (!['AVAILABLE', 'BOOKED'].includes(vehicle.status) && String(vehicle._id) !== String(booking.vehicleId)) {
      throw new ApiError(409, `Vehicle is ${vehicle.status.replace('_', ' ')} — not available for this booking`);
    }
    vehicle.status = 'BOOKED';
    await vehicle.save();
    booking.vehicleId = vehicle._id;
  } else {
    booking.vehicleId = undefined;
  }

  if (booking.bookingStatus === 'PENDING' && booking.vehicleId && booking.assignedExecutive) {
    booking.bookingStatus = 'CONFIRMED';
  }

  await booking.save();

  await booking.populate([
    { path: 'vehicleId', select: 'vehicleId model variant registrationNo color status' },
    { path: 'assignedExecutive', select: 'name email' },
    { path: 'customerId', select: 'name mobile' }
  ]);

  res.json({
    success: true,
    data: booking,
    message: vehicleId ? 'Demo vehicle assigned to booking' : 'Vehicle removed from booking'
  });
});

exports.getMyBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = { assignedExecutive: req.admin._id };
  if (req.query.status) query.bookingStatus = req.query.status;
  if (req.query.date) {
    const bounds = calendarDateBounds(req.query.date);
    if (bounds) {
      query.slotDate = { $gte: bounds.startOfDay, $lte: bounds.endOfDay };
    }
  }

  const [docs, total] = await Promise.all([
    TDBooking.find(query)
      .populate('customerId', 'name mobile customerId email city')
      .populate('vehicleId', 'vehicleId model registrationNo color')
      .populate('assignedExecutive', 'name email designation')
      .populate('branchId', '_id name code')
      .populate('testDriveId', 'customerName mobile email city model variant preferredTestDriveLocation ownsCar currentCarDetails purchaseTimeline remarks status')
      .sort({ slotDate: 1, slotTime: 1 })
      .skip(skip).limit(limit),
    TDBooking.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});
