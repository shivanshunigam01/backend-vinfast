require('../models/tdModels');

const TDBooking = require('../models/TDBooking');
const TDStaff = require('../models/TDStaff');
const TDVehicle = require('../models/TDVehicle');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { formatTdBooking } = require('../utils/tdBookingFormatter');
const { ensureBookingsCustomers, ensureBookingCustomer } = require('../utils/tdCustomerResolver');
const { syncAllLegacyTestDrives } = require('../utils/tdBookingSync');

const BOOKING_POPULATE = [
  { path: 'customerId' },
  { path: 'vehicleId', select: 'vehicleId model registrationNo color' },
  { path: 'assignedExecutive', select: 'name email role designation', model: 'TDStaff' },
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

  let [docs, total] = await Promise.all([
    TDBooking.find(query).populate(BOOKING_POPULATE).sort({ slotDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query),
  ]);

  if (total === 0 && page === 1 && !req.query.status && !req.query.date) {
    await syncAllLegacyTestDrives();
    [docs, total] = await Promise.all([
      TDBooking.find(query).populate(BOOKING_POPULATE).sort({ slotDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      TDBooking.countDocuments(query),
    ]);
  }

  const enriched = await ensureBookingsCustomers(docs);
  const data = enriched.map(formatTdBooking);
  return successResponse(res, data, undefined, 200, { page, limit, total });
});

exports.listMyBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = buildBookingListQuery(req);

  const staffId = req.tdStaff?._id || req.admin?._id;
  if (staffId) query.assignedExecutive = staffId;

  const [docs, total] = await Promise.all([
    TDBooking.find(query).populate(BOOKING_POPULATE).sort({ slotDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query),
  ]);
  const enriched = await ensureBookingsCustomers(docs);
  const data = enriched.map(formatTdBooking);
  return successResponse(res, data, undefined, 200, { page, limit, total });
});

exports.listExecutives = asyncHandler(async (req, res) => {
  const staff = await TDStaff.find({ active: true })
    .select('name email role designation')
    .sort({ designation: 1, name: 1 });

  const data = staff.map((s) => ({
    _id: s._id,
    name: s.name,
    email: s.email,
    role: s.role,
    designation: s.designation,
    designationLabel: require('../utils/tdBookingFormatter').DESIGNATION_LABELS[s.designation] || s.designation,
  }));

  return successResponse(res, data);
});

exports.getBooking = asyncHandler(async (req, res) => {
  let doc = await findBookingById(req.params.id);
  doc = await ensureBookingCustomer(doc);
  await doc.populate(BOOKING_POPULATE);
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
  const staff = await TDStaff.findById(executiveId);
  if (!staff || !staff.active) throw new ApiError(404, 'Executive not found');

  doc.assignedExecutive = staff._id;
  if (doc.bookingStatus === 'PENDING') doc.bookingStatus = 'CONFIRMED';
  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Executive assigned');
});

exports.assignVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.body || {};
  const doc = await findBookingById(req.params.id);

  if (['COMPLETED', 'CANCELLED'].includes(doc.bookingStatus)) {
    throw new ApiError(400, `Cannot change vehicle on a ${doc.bookingStatus} booking`);
  }

  if (doc.vehicleId) {
    const previous = await TDVehicle.findById(doc.vehicleId);
    if (previous && ['BOOKED', 'AVAILABLE'].includes(previous.status)) {
      previous.status = 'AVAILABLE';
      await previous.save();
    }
  }

  if (vehicleId) {
    const vehicle = await TDVehicle.findById(vehicleId);
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    if (doc.preferredModel && vehicle.model !== doc.preferredModel) {
      throw new ApiError(400, `This booking is for ${doc.preferredModel}. Selected vehicle is ${vehicle.model}.`);
    }
    if (
      !['AVAILABLE', 'BOOKED'].includes(vehicle.status) &&
      String(vehicle._id) !== String(doc.vehicleId)
    ) {
      throw new ApiError(409, `Vehicle is ${vehicle.status.replace('_', ' ')} — not available for this booking`);
    }
    vehicle.status = 'BOOKED';
    await vehicle.save();
    doc.vehicleId = vehicle._id;
  } else {
    doc.vehicleId = undefined;
  }

  if (doc.bookingStatus === 'PENDING' && doc.vehicleId && doc.assignedExecutive) {
    doc.bookingStatus = 'CONFIRMED';
  }

  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(
    res,
    formatTdBooking(doc),
    vehicleId ? 'Demo vehicle assigned to booking' : 'Vehicle removed from booking',
  );
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
