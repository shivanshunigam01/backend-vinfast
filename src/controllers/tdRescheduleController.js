require('../models/tdModels');

const TDRescheduleRequest = require('../models/TDRescheduleRequest');
const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { formatTdBooking } = require('../utils/tdBookingFormatter');
const { isoDateOnly } = require('../utils/tdSlotUtils');
const { notifyReschedule } = require('../utils/notifications');

function formatRescheduleRow(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: plain._id,
    bookingId: plain.bookingId,
    bookingCode: plain.bookingCode,
    status: plain.status,
    originalSlot: plain.originalSlot,
    preferredSlots: plain.preferredSlots,
    approvedSlot: plain.approvedSlot,
    reason: plain.reason || null,
    adminNote: plain.adminNote || null,
    requestedByName: plain.requestedByName || null,
    approvedByName: plain.approvedByName || null,
    decidedAt: plain.decidedAt || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

exports.listRescheduleHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};
  if (req.query.status) query.status = String(req.query.status).toUpperCase();
  if (req.query.bookingId) query.bookingId = req.query.bookingId;
  if (req.query.bookingCode) {
    query.bookingCode = new RegExp(String(req.query.bookingCode).trim(), 'i');
  }

  const [docs, total] = await Promise.all([
    TDRescheduleRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('bookingId', 'bookingId bookingStatus customerName customerMobile'),
    TDRescheduleRequest.countDocuments(query),
  ]);

  return successResponse(res, docs.map(formatRescheduleRow), undefined, 200, { page, limit, total });
});

exports.listPendingReschedules = asyncHandler(async (req, res) => {
  const docs = await TDRescheduleRequest.find({ status: 'PENDING' })
    .sort({ createdAt: 1 })
    .limit(100)
    .populate('bookingId', 'bookingId bookingStatus slotDate slotTime preferredModel customerName customerMobile');
  return successResponse(res, docs.map(formatRescheduleRow));
});

/**
 * Admin picks one of the 3 preferred slots (or an alternate approvedSlot) and applies it.
 */
exports.decideReschedule = asyncHandler(async (req, res) => {
  const { decision, preferredIndex, approvedSlot, adminNote } = req.body || {};
  const normalized = String(decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalized)) {
    throw new ApiError(400, 'decision must be APPROVED or REJECTED');
  }

  const request = await TDRescheduleRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, 'Reschedule request not found');
  if (request.status !== 'PENDING') {
    throw new ApiError(400, `Request already ${request.status}`);
  }

  const booking = await TDBooking.findById(request.bookingId).populate('customerId');
  if (!booking) throw new ApiError(404, 'Linked booking not found');

  const actorName = req.admin?.name || req.tdStaff?.name || req.admin?.email || 'Admin';
  const actorId = req.tdStaff?._id || req.admin?._id;

  if (normalized === 'REJECTED') {
    request.status = 'REJECTED';
    request.adminNote = adminNote ? String(adminNote).trim() : undefined;
    request.approvedBy = actorId;
    request.approvedByName = actorName;
    request.decidedAt = new Date();
    await request.save();

    booking.pendingRescheduleRequestId = undefined;
    await booking.save();

    return successResponse(res, formatRescheduleRow(request), 'Reschedule request rejected');
  }

  let chosen = null;
  if (approvedSlot?.slotDate && approvedSlot?.slotTime) {
    const d = new Date(approvedSlot.slotDate);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid approvedSlot.slotDate');
    d.setHours(0, 0, 0, 0);
    chosen = { slotDate: d, slotTime: String(approvedSlot.slotTime).trim() };
  } else if (preferredIndex !== undefined && preferredIndex !== null) {
    const idx = Number(preferredIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2 || !request.preferredSlots[idx]) {
      throw new ApiError(400, 'preferredIndex must be 0, 1, or 2');
    }
    chosen = {
      slotDate: request.preferredSlots[idx].slotDate,
      slotTime: request.preferredSlots[idx].slotTime,
    };
  } else {
    throw new ApiError(400, 'Provide preferredIndex (0-2) or approvedSlot { slotDate, slotTime }');
  }

  booking.slotDate = chosen.slotDate;
  booking.slotTime = chosen.slotTime;
  booking.bookingStatus = 'RESCHEDULED';
  booking.rescheduleCount = (booking.rescheduleCount || 0) + 1;
  booking.pendingRescheduleRequestId = undefined;
  await booking.save();

  if (booking.testDriveId) {
    await TestDrive.findByIdAndUpdate(booking.testDriveId, {
      preferredDate: booking.slotDate,
      preferredTime: booking.slotTime,
      status: 'Rescheduled',
    });
  }

  request.status = 'APPROVED';
  request.approvedSlot = chosen;
  request.adminNote = adminNote ? String(adminNote).trim() : undefined;
  request.approvedBy = actorId;
  request.approvedByName = actorName;
  request.decidedAt = new Date();
  await request.save();

  await notifyReschedule({
    booking,
    customer: booking.customerId,
    requestOnly: false,
  });

  return successResponse(
    res,
    {
      rescheduleRequest: formatRescheduleRow(request),
      booking: formatTdBooking(booking),
      approvedLabel: `${isoDateOnly(chosen.slotDate)} ${chosen.slotTime}`,
    },
    'Reschedule approved and booking updated',
  );
});
