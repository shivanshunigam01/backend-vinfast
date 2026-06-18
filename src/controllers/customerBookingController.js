require('../models/tdModels');

const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { formatTdBooking } = require('../utils/tdBookingFormatter');
const { formatTime12h, isoDateOnly } = require('../utils/tdSlotUtils');
const { computeSlotsForBranchDate } = require('../utils/tdSlotAvailability');

const CUSTOMER_RESCHEDULABLE = new Set(['PENDING', 'CONFIRMED', 'RESCHEDULED']);

function normalizeSlotTime(raw) {
  const s = String(raw || '').trim();
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2];
    const mer = m12[3].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (m24) return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
  return s;
}

function formatCustomerBooking(booking) {
  const base = formatTdBooking(booking);
  return {
    ...base,
    slotDateLabel: booking.slotDate ? isoDateOnly(booking.slotDate) : null,
    slotTimeLabel: booking.slotTime ? formatTime12h(booking.slotTime) : null,
    canReschedule: CUSTOMER_RESCHEDULABLE.has(booking.bookingStatus),
    rescheduleCount: booking.rescheduleCount || 0,
  };
}

const BOOKING_POPULATE = [
  { path: 'branchId', select: 'name code city' },
  { path: 'vehicleId', select: 'vehicleId model registrationNo color variant' },
  { path: 'assignedExecutive', select: 'name email', model: 'TDStaff' },
  { path: 'testDriveId', select: 'customerName mobile model variant preferredTestDriveLocation status' },
];

exports.getMyBookings = asyncHandler(async (req, res) => {
  const docs = await TDBooking.find({ customerId: req.customer._id })
    .populate(BOOKING_POPULATE)
    .sort({ slotDate: -1, slotTime: -1, createdAt: -1 });

  return successResponse(res, docs.map(formatCustomerBooking));
});

exports.getBookingById = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findOne({ _id: req.params.id, customerId: req.customer._id }).populate(
    BOOKING_POPULATE,
  );
  if (!booking) throw new ApiError(404, 'Booking not found');
  return successResponse(res, formatCustomerBooking(booking));
});

exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const { slotDate, slotTime } = req.body || {};
  if (!slotDate || !slotTime) throw new ApiError(400, 'New date and time slot are required');

  const booking = await TDBooking.findOne({ _id: req.params.id, customerId: req.customer._id }).populate(
    'testDriveId',
    'variant',
  );
  if (!booking) throw new ApiError(404, 'Booking not found');

  if (!CUSTOMER_RESCHEDULABLE.has(booking.bookingStatus)) {
    throw new ApiError(400, `This booking cannot be rescheduled (${booking.bookingStatus}).`);
  }

  const normalizedTime = normalizeSlotTime(slotTime);
  const dateIso = isoDateOnly(slotDate);
  const variant = booking.preferredVariant || booking.testDriveId?.variant || null;

  const { slots } = await computeSlotsForBranchDate(booking.branchId, dateIso, {
    model: booking.preferredModel || null,
    variant,
  });

  const slot = slots.find((s) => s.time === normalizedTime);
  if (!slot?.available) {
    throw new ApiError(409, 'Selected slot is not available. Please choose another time.');
  }

  const nextDate = new Date(slotDate);
  if (Number.isNaN(nextDate.getTime())) throw new ApiError(400, 'Invalid slot date');
  nextDate.setHours(0, 0, 0, 0);

  booking.slotDate = nextDate;
  booking.slotTime = normalizedTime;
  booking.bookingStatus = 'RESCHEDULED';
  booking.rescheduleCount = (booking.rescheduleCount || 0) + 1;
  await booking.save();

  if (booking.testDriveId) {
    await TestDrive.findByIdAndUpdate(booking.testDriveId, {
      preferredDate: booking.slotDate,
      preferredTime: booking.slotTime,
      status: 'Rescheduled',
    });
  }

  await booking.populate(BOOKING_POPULATE);
  return successResponse(res, formatCustomerBooking(booking), 'Test drive rescheduled successfully');
});
