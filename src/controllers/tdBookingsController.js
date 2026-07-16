require('../models/tdModels');

const TDBooking = require('../models/TDBooking');
const TDStaff = require('../models/TDStaff');
const TDVehicle = require('../models/TDVehicle');
const TDCustomer = require('../models/TDCustomer');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { formatTdBooking } = require('../utils/tdBookingFormatter');
const { ensureBookingsCustomers, ensureBookingCustomer } = require('../utils/tdCustomerResolver');
const { syncAllLegacyTestDrives } = require('../utils/tdBookingSync');
const {
  isExecutiveScopedUser,
  assignedExecutiveFilterAsync,
  bookingAssignedToStaff,
  applyBookingExecutiveAssignment,
  repairExecutiveBookingAssignments,
} = require('../utils/leadAssignment');
const { cloudinaryConfigured, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');
const { getActiveModelNames } = require('../utils/vehicleCatalog');
const { upsertTDCustomer } = require('../utils/tdCustomerResolver');
const { nextBookingId, resolveBranch, normalizeSlotTime } = require('../utils/tdBookingSync');
const { intakePvLead } = require('../utils/pvLeadIntake');
const { evaluateRepeatDrive } = require('../utils/tdRepeatDrive');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');

/**
 * GET /admin/td/bookings/eligibility?mobile=…&model=… — drives the CRM
 * "Book Test Drive" button state and the repeat-approval UI.
 */
exports.checkBookingEligibility = asyncHandler(async (req, res) => {
  const mobile = String(req.query.mobile || '').replace(/\D/g, '').slice(-10);
  if (!MOBILE_10_REGEX.test(mobile)) throw new ApiError(400, 'Valid 10-digit mobile is required');
  const model = String(req.query.model || '').trim();

  const summary = await evaluateRepeatDrive(mobile, model);
  const isAdmin = ['manager', 'superadmin'].includes(req.admin.role);
  return successResponse(res, {
    mobile,
    model: model || null,
    activeSameModel: summary.activeSameModel,
    completedSameModel: summary.completedSameModel,
    completedAny: summary.completedAny,
    requiresApproval: Boolean(model && summary.completedSameModel),
    canApproveRepeat: isAdmin,
    bookings: summary.bookings,
  });
});

/**
 * POST /admin/td/bookings — staff-created test drive booking (multiple drives
 * per customer profile; repeats after a completed drive need admin approval).
 */
exports.createBookingByStaff = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const name = String(body.customerName || '').trim();
  if (!name) throw new ApiError(400, 'Customer name is required');

  const mobile = String(body.customerMobile || '').replace(/\D/g, '').slice(-10);
  if (!MOBILE_10_REGEX.test(mobile)) {
    throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number');
  }

  const model = String(body.preferredModel || '').trim();
  const validModels = await getActiveModelNames();
  if (!validModels.includes(model)) {
    throw new ApiError(400, `Invalid model. Use one of: ${validModels.join(', ')}`);
  }

  if (!body.slotDate) throw new ApiError(400, 'slotDate is required');
  const slotDate = new Date(body.slotDate);
  if (Number.isNaN(slotDate.getTime())) throw new ApiError(400, 'Invalid slotDate');
  slotDate.setHours(0, 0, 0, 0);
  if (!body.slotTime) throw new ApiError(400, 'slotTime is required');

  const summary = await evaluateRepeatDrive(mobile, model);
  if (summary.activeSameModel) {
    throw new ApiError(
      409,
      `This customer already has an active ${model} test drive (${summary.activeSameModel.bookingId}, ${summary.activeSameModel.bookingStatus}). Reschedule it instead of creating a duplicate.`,
    );
  }

  const isRepeat = Boolean(summary.completedSameModel);
  const isAdmin = ['manager', 'superadmin'].includes(req.admin.role);
  if (isRepeat && !isAdmin) {
    throw new ApiError(
      403,
      `This customer already completed a ${model} test drive (${summary.completedSameModel.bookingId}). A repeat test drive needs manager/admin approval — ask a manager to create it.`,
    );
  }

  const customer = await upsertTDCustomer({
    name,
    mobile,
    email: String(body.customerEmail || '').trim() || undefined,
    city: String(body.customerCity || '').trim() || undefined,
  });
  const branch = await resolveBranch(body.branchName);

  const booking = await TDBooking.create({
    bookingId: nextBookingId(),
    bookingStatus: 'CONFIRMED',
    slotDate,
    slotTime: normalizeSlotTime(body.slotTime),
    slotDuration: 60,
    preferredModel: model,
    remarks: String(body.remarks || '').trim() || undefined,
    customerId: customer._id,
    branchId: branch._id,
    customerName: name,
    customerMobile: mobile,
    customerEmail: String(body.customerEmail || '').trim() || undefined,
    customerCity: String(body.customerCity || '').trim() || undefined,
    isRepeatDrive: isRepeat,
    repeatApprovedBy: isRepeat ? req.admin._id : undefined,
    createdByAdmin: req.admin._id,
  });

  // Link the CRM side: update the source lead when given, otherwise run the standard intake.
  let lead = null;
  if (body.leadId) {
    lead = await Lead.findById(body.leadId);
  }
  if (lead) {
    lead.tdBookingId = booking._id;
    if (!['Booking', 'Delivered', 'Lost'].includes(lead.status)) {
      lead.status = 'Test Drive Booked';
    }
    lead.lastActivityAt = new Date();
    await lead.save();
    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: booking._id,
      fromStage: lead.status,
      toStage: lead.status,
      changedBy: req.admin._id,
      reason: `Test drive booked from CRM (${booking.bookingId}, ${model})${isRepeat ? ' — repeat drive approved' : ''}`,
    });
  } else {
    await intakePvLead({
      name,
      mobile,
      email: String(body.customerEmail || '').trim() || undefined,
      city: String(body.customerCity || '').trim() || undefined,
      model,
      source: 'Test Drive',
      status: 'Test Drive Booked',
      interest: 'Test Drive',
      tdBookingId: booking._id,
      remarks: `Test drive booked by staff for ${slotDate.toISOString().slice(0, 10)} ${booking.slotTime}`,
      changedBy: req.admin._id,
      historyReason: `Test drive booked by ${req.admin.name || 'staff'}${isRepeat ? ' (repeat drive)' : ''}`,
    }).catch((err) => console.error('[createBookingByStaff intake]', err));
  }

  const fresh = await findBookingById(booking._id);
  return successResponse(
    res,
    formatTdBooking(fresh),
    isRepeat ? 'Repeat test drive booked with admin approval' : 'Test drive booked',
    201,
  );
});

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

function assertBookingReadable(booking, admin) {
  if (!isExecutiveScopedUser(admin)) return;
  if (!bookingAssignedToStaff(booking, admin._id, admin.email)) {
    throw new ApiError(403, 'This booking is not assigned to you');
  }
}

function assertAdminEditRights(admin) {
  if (!['manager', 'superadmin'].includes(admin.role)) {
    throw new ApiError(403, 'Only managers and admins can edit booking details');
  }
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

  if (isExecutiveScopedUser(req.admin)) {
    await repairExecutiveBookingAssignments(req.admin);
    Object.assign(query, await assignedExecutiveFilterAsync(req.admin));
  } else {
    const staffId = req.tdStaff?._id || req.admin?._id;
    if (staffId) query.assignedExecutive = staffId;
  }

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
  assertBookingReadable(doc, req.admin);
  doc = await ensureBookingCustomer(doc);
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc));
});

exports.updateBooking = asyncHandler(async (req, res) => {
  const doc = await findBookingById(req.params.id);
  assertBookingReadable(doc, req.admin);
  const { bookingStatus, dlVerified } = req.body || {};

  if (bookingStatus !== undefined) doc.bookingStatus = String(bookingStatus).toUpperCase();
  if (dlVerified !== undefined) doc.dlVerified = Boolean(dlVerified);

  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Updated successfully');
});

const MOBILE_10_REGEX = /^[6-9]\d{9}$/;

/**
 * Admin edit of booking details: customer identity (name/mobile/email/city),
 * vehicle model selection, and remarks. Syncs the linked TDCustomer profile
 * and the original website TestDrive record so all views stay consistent.
 */
exports.updateBookingDetails = asyncHandler(async (req, res) => {
  assertAdminEditRights(req.admin);
  const doc = await findBookingById(req.params.id);

  const { customerName, customerMobile, customerEmail, customerCity, preferredModel, remarks } =
    req.body || {};

  const name = customerName !== undefined ? String(customerName).trim() : undefined;
  if (name !== undefined && !name) throw new ApiError(400, 'Customer name cannot be empty');

  let mobile;
  if (customerMobile !== undefined) {
    mobile = String(customerMobile).replace(/\D/g, '').slice(-10);
    if (!MOBILE_10_REGEX.test(mobile)) {
      throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number');
    }
  }

  const email = customerEmail !== undefined ? String(customerEmail).trim() : undefined;
  const city = customerCity !== undefined ? String(customerCity).trim() : undefined;

  let model;
  if (preferredModel !== undefined) {
    model = String(preferredModel).trim();
    const validModels = await getActiveModelNames();
    if (!validModels.includes(model)) {
      throw new ApiError(400, `Invalid model. Use one of: ${validModels.join(', ')}`);
    }
  }

  // Booking (denormalized fields)
  if (name !== undefined) doc.customerName = name;
  if (mobile !== undefined) doc.customerMobile = mobile;
  if (email !== undefined) doc.customerEmail = email || undefined;
  if (city !== undefined) doc.customerCity = city || undefined;
  if (remarks !== undefined) doc.remarks = String(remarks).trim() || undefined;

  if (model !== undefined && doc.preferredModel !== model) {
    doc.preferredModel = model;
    // Release an assigned demo vehicle that no longer matches the chosen model.
    if (doc.vehicleId) {
      const assigned = await TDVehicle.findById(doc.vehicleId._id || doc.vehicleId);
      if (assigned && assigned.model !== model) {
        if (['BOOKED', 'AVAILABLE'].includes(assigned.status)) {
          assigned.status = 'AVAILABLE';
          await assigned.save();
        }
        doc.vehicleId = undefined;
      }
    }
  }

  await doc.save();

  // Sync the linked TDCustomer profile.
  const customerRef = doc.customerId?._id || doc.customerId;
  if (customerRef && (name !== undefined || mobile !== undefined || email !== undefined || city !== undefined)) {
    const update = {};
    if (name !== undefined) update.name = name;
    if (mobile !== undefined) update.mobile = mobile;
    if (email !== undefined) update.email = email || undefined;
    if (city !== undefined) update.city = city || undefined;
    await TDCustomer.updateOne({ _id: customerRef }, { $set: update });
  }

  // Sync the original website TestDrive record shown in the booking dialog.
  const testDriveRef = doc.testDriveId?._id || doc.testDriveId;
  if (testDriveRef) {
    const update = {};
    if (name !== undefined) update.customerName = name;
    if (mobile !== undefined) update.mobile = mobile;
    if (email !== undefined) update.email = email || undefined;
    if (city !== undefined) update.city = city || undefined;
    if (model !== undefined) update.model = model;
    if (remarks !== undefined) update.remarks = String(remarks).trim() || undefined;
    if (Object.keys(update).length) {
      await TestDrive.updateOne({ _id: testDriveRef }, { $set: update }, { runValidators: true });
    }
  }

  const fresh = await findBookingById(doc._id);
  return successResponse(res, formatTdBooking(fresh), 'Booking details updated');
});

exports.verifyDrivingLicence = asyncHandler(async (req, res) => {
  const doc = await findBookingById(req.params.id);
  assertBookingReadable(doc, req.admin);

  const hasExistingImage = Boolean(doc.dlVerified && doc.dlImageUrl);
  // A new image is mandatory on first verification; on re-edit the existing image is kept.
  if (!req.file && !hasExistingImage) {
    throw new ApiError(400, 'Upload a driving licence image to verify');
  }

  const dlNumber = String(req.body?.dlNumber || '').trim().toUpperCase();
  const dlValidUntilRaw = String(req.body?.dlValidUntil || '').trim();
  if (!dlNumber) throw new ApiError(400, 'Driving licence number is required');
  if (!dlValidUntilRaw) throw new ApiError(400, 'Driving licence validity date is required');

  const dlValidUntil = new Date(dlValidUntilRaw);
  if (Number.isNaN(dlValidUntil.getTime())) {
    throw new ApiError(400, 'Invalid driving licence validity date');
  }

  if (req.file) {
    if (!cloudinaryConfigured()) {
      throw new ApiError(503, 'Image storage is not configured on the server');
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      public_id: `td-dl-${doc.bookingId || doc._id}-${Date.now()}`,
    });

    if (doc.dlImagePublicId && doc.dlImagePublicId !== uploaded.public_id) {
      try {
        const cloudinary = require('../config/cloudinary');
        await cloudinary.uploader.destroy(doc.dlImagePublicId, { resource_type: 'image' });
      } catch {
        /* ignore cleanup errors */
      }
    }

    doc.dlImageUrl = uploaded.secure_url;
    doc.dlImagePublicId = uploaded.public_id;
  }

  doc.dlVerified = true;
  doc.dlVerifiedAt = new Date();
  doc.dlNumber = dlNumber;
  doc.dlValidUntil = dlValidUntil;

  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Driving licence verified and saved');
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const doc = await findBookingById(req.params.id);
  doc.bookingStatus = 'CANCELLED';
  doc.cancellationReason = req.body?.reason ? String(req.body.reason).trim() : undefined;
  await doc.save();
  await doc.populate(BOOKING_POPULATE);
  return successResponse(res, formatTdBooking(doc), 'Booking cancelled');
});

/**
 * Permanently remove a junk/incorrect booking from the database.
 * Managers/superadmins only. Releases any BOOKED demo vehicle back to AVAILABLE.
 */
exports.deleteBooking = asyncHandler(async (req, res) => {
  if (!['manager', 'superadmin'].includes(req.admin.role)) {
    throw new ApiError(403, 'Only managers and admins can delete bookings');
  }

  const doc = await findBookingById(req.params.id);
  if (doc.bookingStatus === 'IN_PROGRESS') {
    throw new ApiError(400, 'Cannot delete a booking that is currently in progress — end the drive first');
  }

  if (doc.vehicleId) {
    const vehicle = await TDVehicle.findById(doc.vehicleId);
    if (vehicle && ['BOOKED', 'AVAILABLE'].includes(vehicle.status)) {
      vehicle.status = 'AVAILABLE';
      await vehicle.save();
    }
  }

  const bookingId = doc.bookingId;
  await doc.deleteOne();
  return successResponse(res, { _id: doc._id, bookingId }, `Booking ${bookingId} deleted`);
});

exports.assignExecutive = asyncHandler(async (req, res) => {
  const { executiveId } = req.body || {};
  if (!executiveId) throw new ApiError(400, 'executiveId is required');

  const doc = await findBookingById(req.params.id);
  const staff = await TDStaff.findById(executiveId);
  if (!staff || !staff.active) throw new ApiError(404, 'Executive not found');

  applyBookingExecutiveAssignment(doc, staff);
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

/**
 * Admin approval for repeat test drives. Executives raise repeat requests
 * (approvalStatus PENDING); managers/superadmins approve or reject here.
 */
exports.decideRepeatApproval = asyncHandler(async (req, res) => {
  if (!['manager', 'superadmin'].includes(req.admin.role)) {
    throw new ApiError(403, 'Only managers and admins can approve repeat test drives');
  }

  const { decision, note } = req.body || {};
  const normalized = String(decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalized)) {
    throw new ApiError(400, 'decision must be APPROVED or REJECTED');
  }

  const doc = await findBookingById(req.params.id);
  if (doc.approvalStatus !== 'PENDING') {
    throw new ApiError(400, `This booking is not awaiting approval (${doc.approvalStatus})`);
  }

  doc.approvalStatus = normalized;
  doc.approvalDecisionBy = req.admin._id;
  doc.approvalDecidedAt = new Date();
  if (note) doc.approvalNote = String(note).trim();

  if (normalized === 'APPROVED') {
    if (doc.bookingStatus === 'PENDING') doc.bookingStatus = 'CONFIRMED';
  } else {
    doc.bookingStatus = 'CANCELLED';
    doc.cancellationReason = doc.approvalNote || 'Repeat test drive request rejected';
  }
  await doc.save();

  // Reflect the decision on the linked CRM lead's history.
  if (doc.leadId) {
    const LeadStageHistory = require('../models/LeadStageHistory');
    const Lead = require('../models/Lead');
    const lead = await Lead.findById(doc.leadId);
    if (lead) {
      if (normalized === 'APPROVED') {
        const prevStage = lead.status;
        if (['Enquiry', 'Interested', 'Test Drive Booked', 'Test Drive Completed'].includes(lead.status)) {
          lead.status = 'Test Drive Booked';
        }
        lead.tdBookingId = doc._id;
        lead.lastActivityAt = new Date();
        await lead.save();
        await LeadStageHistory.create({
          leadId: lead._id,
          bookingId: doc._id,
          fromStage: prevStage,
          toStage: lead.status,
          changedBy: req.admin._id,
          reason: `Repeat test drive approved (${doc.bookingId})${doc.approvalNote ? ` · ${doc.approvalNote}` : ''}`,
        });
      } else {
        await LeadStageHistory.create({
          leadId: lead._id,
          bookingId: doc._id,
          fromStage: lead.status,
          toStage: lead.status,
          changedBy: req.admin._id,
          reason: `Repeat test drive rejected (${doc.bookingId})${doc.approvalNote ? ` · ${doc.approvalNote}` : ''}`,
        });
      }
    }
  }

  await doc.populate(BOOKING_POPULATE);
  return successResponse(
    res,
    formatTdBooking(doc),
    normalized === 'APPROVED' ? 'Repeat test drive approved' : 'Repeat test drive rejected',
  );
});

/** Repeat test drive requests awaiting admin decision. */
exports.listPendingApprovals = asyncHandler(async (req, res) => {
  if (!['manager', 'superadmin'].includes(req.admin.role)) {
    throw new ApiError(403, 'Only managers and admins can view approval requests');
  }
  const docs = await TDBooking.find({ approvalStatus: 'PENDING' })
    .populate(BOOKING_POPULATE)
    .populate('approvalRequestedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(100);
  const enriched = await ensureBookingsCustomers(docs);
  return successResponse(res, enriched.map(formatTdBooking));
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
