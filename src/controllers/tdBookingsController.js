const TDBooking = require('../models/TDBooking');
const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { formatTdBooking } = require('../utils/tdBookingFormatter');

const BOOKING_POPULATE = [
  { path: 'customerId' },
  { path: 'vehicleId', select: 'vehicleId model registrationNo color' },
  { path: 'assignedExecutive', select: 'name email role', model: 'Admin' },
  { path: 'branchId', select: 'name code' },
  { path: 'testDriveId' },
];

function buildBookingListQuery(req) {
  const query = {};
  if (req.query.status) query.bookingStatus = String(req.query.status).toUpperCase();
  if (req.query.date) {
    const day = new Date(req.query.date);
    if (!Number.isNaN(day.getTime())) {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      query.slotDate = { $gte: day, $lt: next };
    }
  }
  return query;
}

async function findBookingById(id) {
  const doc = await TDBooking.findById(id).populate(BOOKING_POPULATE);
  if (!doc) throw new ApiError(404, 'Booking not found');
  return doc;
}

exports.listBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = buildBookingListQuery(req);
  const [docs, total] = await Promise.all([
    TDBooking.find(query).populate(BOOKING_POPULATE).sort({ slotDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query),
  ]);
  const data = docs.map(formatTdBooking);
  return successResponse(res, data, undefined, 200, { page, limit, total });
});

exports.listMyBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = buildBookingListQuery(req);
  query.assignedExecutive = req.admin._id;

  const [docs, total] = await Promise.all([
    TDBooking.find(query).populate(BOOKING_POPULATE).sort({ slotDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query),
  ]);
  const data = docs.map(formatTdBooking);
  return successResponse(res, data, undefined, 200, { page, limit, total });
});

exports.listExecutives = asyncHandler(async (req, res) => {
  const admins = await Admin.find({ active: true, role: { $in: ['executive', 'manager'] } })
    .select('name email role')
    .sort({ name: 1 });

  const data = admins.map((a) => ({
    _id: a._id,
    name: a.name,
    email: a.email,
    role: a.role,
    designation: a.role === 'executive' ? 'sales_executive' : 'sales_manager',
    designationLabel: a.role === 'executive' ? 'Sales Executive' : 'Sales Manager',
  }));

  return successResponse(res, data);
});

exports.getBooking = asyncHandler(async (req, res) => {
  const doc = await findBookingById(req.params.id);
  return successResponse(res, formatTdBooking(doc));
});

exports.updateBooking = asyncHandler(async (req, res) => {
  const doc = await findBookingById(req.params.id);
  const { bookingStatus, dlVerified } = req.body || {};

  if (bookingStatus !== undefined) doc.bookingStatus = String(bookingStatus).toUpperCase();
  if (dlVerified !== undefined) doc.dlVerified = Boolean(dlVerified);

  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Updated successfully');
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const doc = await findBookingById(req.params.id);
  doc.bookingStatus = 'CANCELLED';
  doc.cancellationReason = req.body?.reason ? String(req.body.reason).trim() : undefined;
  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Booking cancelled');
});

exports.assignExecutive = asyncHandler(async (req, res) => {
  const { executiveId } = req.body || {};
  if (!executiveId) throw new ApiError(400, 'executiveId is required');

  const doc = await findBookingById(req.params.id);
  const admin = await Admin.findById(executiveId);
  if (!admin || !admin.active) throw new ApiError(404, 'Executive not found');

  doc.assignedExecutive = admin._id;
  if (doc.bookingStatus === 'PENDING') doc.bookingStatus = 'CONFIRMED';
  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Executive assigned');
});

exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const { slotDate, slotTime } = req.body || {};
  if (!slotDate || !slotTime) throw new ApiError(400, 'slotDate and slotTime are required');

  const doc = await findBookingById(req.params.id);
  const nextDate = new Date(slotDate);
  if (Number.isNaN(nextDate.getTime())) throw new ApiError(400, 'Invalid slotDate');

  doc.slotDate = nextDate;
  doc.slotTime = String(slotTime).trim();
  if (!['COMPLETED', 'CANCELLED', 'MISSED'].includes(doc.bookingStatus)) {
    doc.bookingStatus = 'RESCHEDULED';
  }
  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Booking rescheduled');
});
