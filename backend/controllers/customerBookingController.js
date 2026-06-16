const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { isSlotAvailable } = require('../utils/slotEngine');
const TDSlotConfig = require('../models/TDSlotConfig');
const { normalizeTimeTo24h, toLocalMidnight, formatTime12h } = require('../utils/timeFormat');

const CUSTOMER_RESCHEDULABLE = new Set(['PENDING', 'CONFIRMED', 'RESCHEDULED']);

exports.getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await TDBooking.find({ customerId: req.customer._id })
    .populate('branchId', 'name code city')
    .populate('vehicleId', 'vehicleId model variant registrationNo color')
    .populate('assignedExecutive', 'name email')
    .populate('testDriveId', 'customerName mobile model variant preferredTestDriveLocation status')
    .sort({ slotDate: -1, slotTime: -1, createdAt: -1 });

  res.json({
    success: true,
    data: bookings.map((b) => ({
      ...b.toObject(),
      slotDateLabel: b.slotDate ? b.slotDate.toISOString().split('T')[0] : null,
      slotTimeLabel: b.slotTime ? formatTime12h(b.slotTime) : null,
      canReschedule: CUSTOMER_RESCHEDULABLE.has(b.bookingStatus)
    }))
  });
});

exports.getBookingById = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findOne({ _id: req.params.id, customerId: req.customer._id })
    .populate('branchId', 'name code city')
    .populate('vehicleId', 'vehicleId model variant registrationNo color')
    .populate('assignedExecutive', 'name email')
    .populate('testDriveId');

  if (!booking) throw new ApiError(404, 'Booking not found');

  res.json({
    success: true,
    data: {
      ...booking.toObject(),
      slotTimeLabel: booking.slotTime ? formatTime12h(booking.slotTime) : null,
      canReschedule: CUSTOMER_RESCHEDULABLE.has(booking.bookingStatus)
    }
  });
});

exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const { slotDate, slotTime } = req.body;
  if (!slotDate || !slotTime) throw new ApiError(400, 'New date and time slot are required');

  const booking = await TDBooking.findOne({ _id: req.params.id, customerId: req.customer._id })
    .populate('testDriveId', 'variant');
  if (!booking) throw new ApiError(404, 'Booking not found');

  if (!CUSTOMER_RESCHEDULABLE.has(booking.bookingStatus)) {
    throw new ApiError(400, `This booking cannot be rescheduled (${booking.bookingStatus}).`);
  }

  const config = await TDSlotConfig.findOne({ branchId: booking.branchId, active: true });
  const maxConcurrent = config ? config.maxConcurrentBookings : 2;
  const bookingVariant = booking.preferredVariant || booking.testDriveId?.variant || null;

  const slotOk = await isSlotAvailable(
    booking.branchId,
    slotDate,
    slotTime,
    maxConcurrent,
    booking._id,
    booking.preferredModel || null,
    bookingVariant
  );
  if (!slotOk) throw new ApiError(409, 'Selected slot is not available. Please choose another time.');

  booking.slotDate = toLocalMidnight(slotDate) || new Date(slotDate);
  booking.slotTime = normalizeTimeTo24h(slotTime) || slotTime;
  booking.bookingStatus = 'RESCHEDULED';
  booking.rescheduleCount += 1;
  await booking.save();

  if (booking.testDriveId) {
    await TestDrive.findByIdAndUpdate(booking.testDriveId, {
      preferredDate: booking.slotDate,
      preferredTime: booking.slotTime,
      status: 'Rescheduled'
    });
  }

  await booking.populate([
    { path: 'branchId', select: 'name code city' },
    { path: 'testDriveId', select: 'model variant status' }
  ]);

  res.json({
    success: true,
    data: {
      ...booking.toObject(),
      slotTimeLabel: formatTime12h(booking.slotTime),
      canReschedule: true
    },
    message: 'Test drive rescheduled successfully'
  });
});
