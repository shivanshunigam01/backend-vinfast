require('../models/tdModels');

const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const TDRescheduleRequest = require('../models/TDRescheduleRequest');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { formatTdBooking } = require('../utils/tdBookingFormatter');
const { formatTime12h, isoDateOnly } = require('../utils/tdSlotUtils');
const { notifyReschedule } = require('../utils/notifications');
const { reverseGeocode } = require('../utils/reverseGeocode');

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
    hasPendingReschedule: Boolean(booking.pendingRescheduleRequestId),
  };
}

const BOOKING_POPULATE = [
  { path: 'branchId', select: 'name code city' },
  { path: 'vehicleId', select: 'vehicleId model registrationNo color variant' },
  { path: 'assignedExecutive', select: 'name email', model: 'TDStaff' },
  { path: 'testDriveId', select: 'customerName mobile model variant preferredTestDriveLocation status' },
];

async function assertPreferredSlotsAvailable(booking, preferredSlots) {
  if (!Array.isArray(preferredSlots) || preferredSlots.length !== 3) {
    throw new ApiError(400, 'Submit exactly 3 preferred date/time options');
  }

  const normalized = [];
  for (const pref of preferredSlots) {
    if (!pref?.slotDate || !pref?.slotTime) {
      throw new ApiError(400, 'Each preferred option needs slotDate and slotTime');
    }
    const normalizedTime = normalizeSlotTime(pref.slotTime);
    const nextDate = new Date(pref.slotDate);
    if (Number.isNaN(nextDate.getTime())) throw new ApiError(400, 'Invalid preferred slot date');
    nextDate.setHours(0, 0, 0, 0);
    // Soft check: warn if clearly in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (nextDate < today) {
      throw new ApiError(400, 'Preferred dates must be today or later');
    }
    normalized.push({ slotDate: nextDate, slotTime: normalizedTime });
  }

  const keys = new Set(normalized.map((s) => `${isoDateOnly(s.slotDate)}|${s.slotTime}`));
  if (keys.size < 2) {
    throw new ApiError(400, 'Provide at least 2 different preferred slot options');
  }

  return normalized;
}

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

/**
 * MoM #4: Customer submits 3 preferred slots; dealership assigns one.
 * Does NOT change the booking slot until admin approval.
 */
exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const { preferredSlots, reason, slotDate, slotTime } = req.body || {};

  const booking = await TDBooking.findOne({ _id: req.params.id, customerId: req.customer._id }).populate(
    'testDriveId',
    'variant',
  );
  if (!booking) throw new ApiError(404, 'Booking not found');

  if (!CUSTOMER_RESCHEDULABLE.has(booking.bookingStatus)) {
    throw new ApiError(400, `This booking cannot be rescheduled (${booking.bookingStatus}).`);
  }

  if (booking.pendingRescheduleRequestId) {
    throw new ApiError(409, 'A reschedule request is already pending for this booking.');
  }

  // Back-compat: single slotDate/slotTime alone is rejected — MoM requires 3 options.
  let slotsInput = preferredSlots;
  if (!slotsInput && slotDate && slotTime) {
    throw new ApiError(
      400,
      'Reschedule now requires exactly 3 preferred time-slot options (preferredSlots).',
    );
  }

  const normalizedSlots = await assertPreferredSlotsAvailable(booking, slotsInput);

  const request = await TDRescheduleRequest.create({
    bookingId: booking._id,
    bookingCode: booking.bookingId,
    status: 'PENDING',
    originalSlot: {
      slotDate: booking.slotDate,
      slotTime: booking.slotTime,
    },
    preferredSlots: normalizedSlots,
    reason: reason ? String(reason).trim() : undefined,
    requestedByCustomer: req.customer._id,
    requestedByName: req.customer.name || 'Customer',
  });

  booking.pendingRescheduleRequestId = request._id;
  await booking.save();

  await notifyReschedule({ booking, customer: req.customer, requestOnly: true });

  await booking.populate(BOOKING_POPULATE);
  return successResponse(
    res,
    {
      booking: formatCustomerBooking(booking),
      rescheduleRequest: request,
    },
    'Reschedule request submitted. Our team will confirm the best available slot.',
  );
});

/** Optional: customer can attach GPS for reverse geocoding / address display. */
exports.updateLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body || {};
  const booking = await TDBooking.findOne({ _id: req.params.id, customerId: req.customer._id });
  if (!booking) throw new ApiError(404, 'Booking not found');

  const geo = await reverseGeocode(lat, lng);
  booking.customerLat = geo.lat;
  booking.customerLng = geo.lng;
  booking.customerAddress = geo.formattedAddress || undefined;
  await booking.save();
  await booking.populate(BOOKING_POPULATE);
  return successResponse(res, formatCustomerBooking(booking), 'Location updated');
});
