const TDBooking = require('../models/TDBooking');
const TDCustomer = require('../models/TDCustomer');

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'];

/** All bookings linked to a mobile number (via TDCustomer or denormalized field). */
async function findBookingsByMobile(mobile10) {
  const customers = await TDCustomer.find({ mobile: mobile10 }).select('_id').lean();
  const customerIds = customers.map((c) => c._id);
  return TDBooking.find({
    $or: [
      ...(customerIds.length ? [{ customerId: { $in: customerIds } }] : []),
      { customerMobile: mobile10 },
    ],
  })
    .select('bookingId bookingStatus preferredModel slotDate slotTime isRepeatDrive')
    .sort({ slotDate: -1 })
    .lean();
}

/**
 * Repeat/duplicate rules for a new test drive request:
 * - active booking for the same model → duplicate (reschedule instead);
 * - COMPLETED drive for the same model → repeat, needs manager/superadmin approval;
 * - different model → allowed (multiple test drives per customer profile).
 */
async function evaluateRepeatDrive(mobile10, model) {
  const bookings = await findBookingsByMobile(mobile10);
  const sameModel = bookings.filter((b) => (b.preferredModel || '') === String(model || '').trim());
  return {
    bookings,
    activeSameModel: sameModel.find((b) => ACTIVE_BOOKING_STATUSES.includes(b.bookingStatus)) || null,
    completedSameModel: sameModel.find((b) => b.bookingStatus === 'COMPLETED') || null,
    completedAny: bookings.find((b) => b.bookingStatus === 'COMPLETED') || null,
  };
}

module.exports = { findBookingsByMobile, evaluateRepeatDrive, ACTIVE_BOOKING_STATUSES };
