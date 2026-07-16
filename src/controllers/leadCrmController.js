require('../models/tdModels');
require('../models/Counter');

const PVCustomer = require('../models/PVCustomer');

const Lead = require('../models/Lead');
const { normalizeLeadModelForStorage, isValidLeadModel } = require('../utils/leadModel');
const { intakePvLead, findOpenLeadForCustomer } = require('../utils/pvLeadIntake');
const { assignPvIds } = require('../utils/pvLeadIntake');
const LeadStageHistory = require('../models/LeadStageHistory');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDStaff = require('../models/TDStaff');
const { STAFF_DESIGNATIONS } = require('../models/TDStaff');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { CRM_LEAD_STAGES, isCrmStaffRole, normalizeStageLabel } = require('../constants/leadStages');
const { listAssignableStaff } = require('./tdUsersController');
const {
  toObjectId,
  isExecutiveScopedUser,
  assignedToStaffFilter,
  assignedToStaffFilterAsync,
  leadAssignedToStaff,
  applyLeadAssignment,
  applyBookingExecutiveAssignment,
  repairExecutiveLeadAssignments,
  touchLeadActivity,
  CRM_LEAD_LIST_SORT,
} = require('../utils/leadAssignment');
const TDBooking = require('../models/TDBooking');
const { ensureParentCustomer } = require('../utils/pvLeadIntake');
const { nextBookingId, resolveBranch, normalizeSlotTime } = require('../utils/tdBookingSync');
const { upsertTDCustomer } = require('../utils/tdCustomerResolver');
const { formatTdBooking } = require('../utils/tdBookingFormatter');
const { getActiveModelNames } = require('../utils/vehicleCatalog');
const {
  getCustomerTestDriveState,
  findCustomerByMobile,
} = require('../utils/customerHistoryBuilder');

const LEAD_POPULATE = [
  { path: 'assignedTo', select: 'name email role designation' },
  { path: 'pvCustomerId', select: 'customerId name mobile email city isSubCustomer parentCustomer vehicleRegistration' },
  { path: 'subCustomerId', select: 'customerId name mobile vehicleRegistration isSubCustomer' },
];

function assertCrmAccess(admin) {
  if (!isCrmStaffRole(admin.role)) {
    throw new ApiError(403, 'Lead CRM access is for executives and managers only');
  }
}

function assertCanAssignLeads(admin) {
  if (!['manager', 'superadmin'].includes(admin.role)) {
    throw new ApiError(403, 'Only managers can assign leads to executives');
  }
}

function assertAdminEditRights(admin) {
  if (!['manager', 'superadmin'].includes(admin.role)) {
    throw new ApiError(403, 'Only managers and admins can edit lead details');
  }
}

function assertLeadReadable(lead, admin) {
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (isExecutiveScopedUser(admin) && !leadAssignedToStaff(lead, admin._id, admin.email)) {
    throw new ApiError(403, 'This lead is not assigned to you');
  }
}

async function ensureLeadIds(doc) {
  if (!doc) return doc;
  if (doc.leadId && doc.opportunityId) return doc;
  await assignPvIds(doc);
  await Lead.updateOne(
    { _id: doc._id },
    { $set: { leadId: doc.leadId, opportunityId: doc.opportunityId } },
    { timestamps: false },
  );
  return doc;
}

function formatCrmLead(doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  const customer = plain.pvCustomerId;
  const subCustomer = plain.subCustomerId;
  return {
    ...plain,
    customerId: customer?.customerId || null,
    customerName: customer?.name || plain.name,
    parentCustomerId: customer?.customerId || null,
    subCustomerCode: subCustomer?.customerId || null,
    subCustomerName: subCustomer?.name || null,
    vehicleRegistration: plain.vehicleRegistration || subCustomer?.vehicleRegistration || null,
  };
}

async function buildLeadQuery(admin, queryParams = {}) {
  const query = {};
  if (isExecutiveScopedUser(admin)) {
    query.$and = query.$and || [];
    query.$and.push(await assignedToStaffFilterAsync(admin));
  } else if (queryParams.assignedTo) {
    if (queryParams.assignedTo === 'unassigned') {
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] });
    } else {
      const assignee = await TDStaff.findById(queryParams.assignedTo).select('email').lean();
      query.$and = query.$and || [];
      query.$and.push(assignedToStaffFilter(queryParams.assignedTo, assignee?.email));
    }
  } else if (queryParams.mine === 'true') {
    query.$and = query.$and || [];
    query.$and.push(await assignedToStaffFilterAsync(admin));
  }

  if (queryParams.status) query.status = queryParams.status;
  if (queryParams.model) query.model = queryParams.model;
  if (queryParams.source) query.source = queryParams.source;
  if (queryParams.from || queryParams.to) {
    const range = {};
    if (queryParams.from) range.$gte = new Date(queryParams.from);
    if (queryParams.to) range.$lte = new Date(`${queryParams.to}T23:59:59.999Z`);

    if (queryParams.dateField === 'activity') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { lastActivityAt: range },
          { lastActivityAt: { $exists: false }, updatedAt: range },
          { lastActivityAt: null, updatedAt: range },
        ],
      });
    } else {
      query.createdAt = range;
    }
  }
  if (queryParams.search) {
    const regex = new RegExp(queryParams.search.trim(), 'i');
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: regex },
        { mobile: regex },
        { email: regex },
        { city: regex },
        { remarks: regex },
        { leadId: regex },
        { opportunityId: regex },
      ],
    });
  }
  if (queryParams.followUpDue === 'true') {
    query.nextFollowUp = { $lte: new Date() };
    query.status = { $nin: ['Delivered', 'Lost', 'Not Interested'] };
  }
  return query;
}

exports.getCrmLeads = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  if (isExecutiveScopedUser(req.admin)) {
    await repairExecutiveLeadAssignments(req.admin);
  }
  const { page, limit, skip } = buildPagination(req);
  const query = await buildLeadQuery(req.admin, req.query);

  const [docs, total] = await Promise.all([
    Lead.find(query)
      .populate(LEAD_POPULATE)
      .sort(CRM_LEAD_LIST_SORT)
      .skip(skip)
      .limit(limit),
    Lead.countDocuments(query),
  ]);

  const data = [];
  for (const doc of docs) {
    await ensureLeadIds(doc);
    data.push(formatCrmLead(doc));
  }

  return successResponse(res, data, undefined, 200, { page, limit, total, stages: CRM_LEAD_STAGES });
});

exports.getCrmLeadDetail = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  let lead = await Lead.findById(req.params.id).populate(LEAD_POPULATE);
  assertLeadReadable(lead, req.admin);
  await ensureLeadIds(lead);

  const [history, followUps, siblingLeads, testDriveState] = await Promise.all([
    LeadStageHistory.find({ leadId: lead._id })
      .populate('changedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(50),
    LeadFollowUp.find({ leadId: lead._id })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100),
    lead.pvCustomerId
      ? Lead.find({ pvCustomerId: lead.pvCustomerId._id || lead.pvCustomerId })
          .select('leadId opportunityId model status source createdAt')
          .sort({ createdAt: -1 })
          .limit(20)
      : [],
    getCustomerTestDriveState(lead.mobile),
  ]);

  const isAdmin = ['manager', 'superadmin'].includes(req.admin.role);
  return successResponse(res, {
    lead: formatCrmLead(lead),
    history,
    followUps,
    siblingLeads,
    stages: CRM_LEAD_STAGES,
    // Drives "Book Test Drive" / "Test Drive Done" button visibility in the UI:
    // once a test drive is completed, only admins can book a repeat drive
    // (executives raise a request that needs admin approval).
    testDrive: {
      hasCompletedTestDrive: testDriveState.hasCompletedTestDrive,
      hasActiveBooking: testDriveState.hasActiveBooking,
      hasPendingApproval: testDriveState.hasPendingApproval,
      canBookTestDrive: testDriveState.canBookTestDrive,
      isRepeat: testDriveState.repeatRequiresAdminApproval,
      requiresAdminApproval: testDriveState.repeatRequiresAdminApproval && !isAdmin,
      showBookTestDrive: testDriveState.canBookTestDrive && !testDriveState.hasCompletedTestDrive,
      showTestDriveDone: !testDriveState.hasCompletedTestDrive,
      bookings: testDriveState.bookings,
    },
  });
});

exports.updateLeadStage = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { stage, reason } = req.body;
  if (!stage) throw new ApiError(400, 'Stage is required');
  if (!CRM_LEAD_STAGES.includes(stage)) {
    throw new ApiError(400, `Invalid stage. Use one of: ${CRM_LEAD_STAGES.join(', ')}`);
  }

  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  const prevStage = lead.status;
  if (prevStage === stage) {
    await lead.populate(LEAD_POPULATE);
    return successResponse(res, formatCrmLead(lead), 'Stage unchanged');
  }

  lead.status = stage;
  touchLeadActivity(lead);
  await lead.save();

  await LeadStageHistory.create({
    leadId: lead._id,
    fromStage: prevStage,
    toStage: stage,
    changedBy: req.admin._id,
    reason: reason || `Stage updated to ${stage}`,
  });

  await lead.populate(LEAD_POPULATE);
  return successResponse(res, formatCrmLead(lead), `Lead moved to ${stage}`);
});

const MOBILE_10_REGEX = /^[6-9]\d{9}$/;

/**
 * Admin edit of core lead details (name, mobile, email, city, model, source, …).
 * Also syncs the linked PVCustomer profile and records the change in lead history.
 */
exports.updateLeadDetails = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  assertAdminEditRights(req.admin);

  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  const {
    name,
    mobile,
    email,
    city,
    otherCity,
    model,
    source,
    interest,
    vehicleRegistration,
    financeNeeded,
    exchangeNeeded,
  } = req.body || {};

  const changes = [];
  const applyString = (field, label, value, { required = false } = {}) => {
    if (value === undefined) return;
    const next = String(value).trim();
    if (!next && required) throw new ApiError(400, `${label} cannot be empty`);
    if ((lead[field] || '') === next) return;
    changes.push(`${label}: ${lead[field] || '—'} → ${next || '—'}`);
    lead[field] = next || undefined;
  };

  if (mobile !== undefined) {
    const digits = String(mobile).replace(/\D/g, '').slice(-10);
    if (!MOBILE_10_REGEX.test(digits)) {
      throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number');
    }
    if (lead.mobile !== digits) {
      changes.push(`Mobile: ${lead.mobile || '—'} → ${digits}`);
      lead.mobile = digits;
    }
  }

  if (model !== undefined) {
    const normalized = normalizeLeadModelForStorage(model);
    if (!isValidLeadModel(normalized)) {
      throw new ApiError(400, 'Invalid vehicle model');
    }
    if (lead.model !== normalized) {
      changes.push(`Model: ${lead.model || '—'} → ${normalized}`);
      lead.model = normalized;
    }
  }

  applyString('name', 'Name', name, { required: true });
  applyString('email', 'Email', email);
  applyString('city', 'City', city, { required: true });
  applyString('otherCity', 'Other city', otherCity);
  applyString('source', 'Source', source);
  applyString('interest', 'Interest', interest);
  applyString('vehicleRegistration', 'Registration', vehicleRegistration);

  if (financeNeeded !== undefined && Boolean(financeNeeded) !== Boolean(lead.financeNeeded)) {
    changes.push(`Finance needed: ${lead.financeNeeded ? 'Yes' : 'No'} → ${financeNeeded ? 'Yes' : 'No'}`);
    lead.financeNeeded = Boolean(financeNeeded);
  }
  if (exchangeNeeded !== undefined && Boolean(exchangeNeeded) !== Boolean(lead.exchangeNeeded)) {
    changes.push(`Exchange needed: ${lead.exchangeNeeded ? 'Yes' : 'No'} → ${exchangeNeeded ? 'Yes' : 'No'}`);
    lead.exchangeNeeded = Boolean(exchangeNeeded);
  }

  if (changes.length === 0) {
    await lead.populate(LEAD_POPULATE);
    return successResponse(res, formatCrmLead(lead), 'No changes to save');
  }

  touchLeadActivity(lead);
  await lead.save();

  // Keep the customer profile (PVCustomer) in sync with the lead identity fields.
  if (lead.pvCustomerId) {
    const customerUpdate = {};
    if (name !== undefined) customerUpdate.name = lead.name;
    if (mobile !== undefined) customerUpdate.mobile = lead.mobile;
    if (email !== undefined) customerUpdate.email = lead.email || undefined;
    if (city !== undefined) customerUpdate.city = lead.city;
    if (otherCity !== undefined) customerUpdate.otherCity = lead.otherCity || undefined;
    if (Object.keys(customerUpdate).length) {
      await PVCustomer.updateOne({ _id: lead.pvCustomerId }, { $set: customerUpdate });
    }
  }

  await LeadStageHistory.create({
    leadId: lead._id,
    fromStage: lead.status,
    toStage: lead.status,
    changedBy: req.admin._id,
    reason: `Details updated: ${changes.join(' · ')}`,
  });

  await lead.populate(LEAD_POPULATE);
  return successResponse(res, formatCrmLead(lead), 'Lead details updated');
});

exports.updateLeadRemarks = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { remarks } = req.body;
  if (remarks == null) throw new ApiError(400, 'Remarks are required');

  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  lead.remarks = String(remarks).trim();
  touchLeadActivity(lead);
  await lead.save();
  await lead.populate(LEAD_POPULATE);

  return successResponse(res, formatCrmLead(lead), 'Remarks saved');
});

exports.addFollowUp = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { note, scheduledAt, outcome, markCompleted } = req.body;
  if (!note || !String(note).trim()) throw new ApiError(400, 'Follow-up note is required');

  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  const scheduled = scheduledAt ? new Date(scheduledAt) : null;
  const isCompleted = Boolean(markCompleted) || !scheduled || scheduled <= new Date();

  const followUp = await LeadFollowUp.create({
    leadId: lead._id,
    createdBy: req.admin._id,
    note: String(note).trim(),
    scheduledAt: scheduled || undefined,
    completedAt: isCompleted ? new Date() : undefined,
    outcome: outcome || undefined,
    status: isCompleted ? 'completed' : 'pending',
  });

  if (scheduled && !isCompleted) {
    lead.nextFollowUp = scheduled;
  }
  touchLeadActivity(lead);
  await lead.save();

  await followUp.populate('createdBy', 'name email');
  return successResponse(res, followUp, 'Follow-up logged', 201);
});

exports.updateFollowUp = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  const followUp = await LeadFollowUp.findOne({ _id: req.params.followUpId, leadId: lead._id });
  if (!followUp) throw new ApiError(404, 'Follow-up not found');

  const { note, scheduledAt, outcome, status } = req.body;
  if (note != null) followUp.note = String(note).trim();
  if (scheduledAt != null) followUp.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined;
  if (outcome != null) followUp.outcome = outcome;
  if (status != null) {
    followUp.status = status;
    if (status === 'completed' && !followUp.completedAt) followUp.completedAt = new Date();
  }

  await followUp.save();
  touchLeadActivity(lead);
  await lead.save();
  await followUp.populate('createdBy', 'name email');

  return successResponse(res, followUp, 'Follow-up updated');
});

exports.listCrmExecutives = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const data = await listAssignableStaff();
  return successResponse(res, data);
});

exports.assignLeadExecutive = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  assertCanAssignLeads(req.admin);

  const { executiveId } = req.body;
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  let assignee = null;
  if (executiveId) {
    assignee = await TDStaff.findOne({
      _id: executiveId,
      active: true,
      designation: { $in: STAFF_DESIGNATIONS },
    }).select('name email role designation');
    if (!assignee) throw new ApiError(404, 'Staff user not found in User Master or inactive');
  }

  const prevAssignee = lead.assignedTo
    ? await TDStaff.findById(lead.assignedTo).select('name')
    : null;

  if (executiveId) {
    applyLeadAssignment(lead, assignee);
  } else {
    applyLeadAssignment(lead, null);
  }
  touchLeadActivity(lead);
  await lead.save();

  const updated = await Lead.findById(lead._id).populate(LEAD_POPULATE);
  if (!updated) throw new ApiError(404, 'Lead not found');

  const assignLabel = assignee ? assignee.name : 'Unassigned';
  const prevLabel = prevAssignee?.name || 'Unassigned';

  await LeadStageHistory.create({
    leadId: lead._id,
    fromStage: lead.status,
    toStage: lead.status,
    changedBy: req.admin._id,
    reason: `Assignment: ${prevLabel} → ${assignLabel}`,
  });

  return successResponse(
    res,
    formatCrmLead(updated),
    executiveId ? `Lead assigned to ${assignLabel}` : 'Lead unassigned',
  );
});

exports.getCrmStages = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  return successResponse(res, CRM_LEAD_STAGES);
});

exports.getCrmSources = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  return successResponse(res, ['Website', 'Meta Ads', 'Test Drive', 'Enquiry', 'Walk-in', 'Executive', 'Referral', 'WhatsApp']);
});

exports.createCrmLead = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);

  const {
    name,
    mobile,
    email,
    city,
    otherCity,
    model,
    interest,
    source,
    remarks,
    financeNeeded,
    exchangeNeeded,
    executiveId,
    subCustomerName,
    subCustomerMobile,
    vehicleRegistration,
    referredByMobile,
  } = req.body;

  let assignedTo = null;
  let assignedToEmail;

  if (req.admin.role === 'executive') {
    assignedTo = toObjectId(req.admin._id) || req.admin._id;
    assignedToEmail = req.admin.email;
  } else if (executiveId) {
    const assignee = await TDStaff.findOne({
      _id: executiveId,
      active: true,
      designation: { $in: STAFF_DESIGNATIONS },
    }).select('_id name email');
    if (!assignee) throw new ApiError(404, 'Staff user not found in User Master or inactive');
    assignedTo = assignee._id;
    assignedToEmail = assignee.email;
  }

  const leadSource =
    source?.trim() ||
    (req.admin.role === 'executive' ? 'Executive' : 'Walk-in');

  // Referral: link the lead back to the referring customer's profile.
  let referrer = null;
  if (referredByMobile) {
    referrer = await findCustomerByMobile(referredByMobile);
  }

  // Existing-customer detection — the UI shows the full-history popup when true.
  const existingCustomer = await findCustomerByMobile(mobile);

  // Duplicate guard: one open lead per mobile. Staff must work the existing
  // lead (test drives can still be booked on it) instead of creating a copy.
  const duplicateLead = await findOpenLeadForCustomer({ mobile: String(mobile).trim() });
  if (duplicateLead) {
    const ref = duplicateLead.leadId || duplicateLead.opportunityId || duplicateLead._id;
    throw new ApiError(
      409,
      `A lead already exists for mobile ${String(mobile).trim()} — ${ref} (stage: ${duplicateLead.status}${
        duplicateLead.assignedToEmail ? `, assigned to ${duplicateLead.assignedToEmail}` : ''
      }). Open that lead to follow up or book a test drive instead of creating a duplicate.`,
    );
  }

  const { lead } = await intakePvLead({
    name: String(name).trim(),
    mobile: String(mobile).trim(),
    email: email || undefined,
    city: String(city).trim(),
    otherCity: otherCity?.trim() || undefined,
    model: normalizeLeadModelForStorage(model),
    interest: interest?.trim() || undefined,
    source: leadSource,
    status: 'Enquiry',
    assignedTo: assignedTo || undefined,
    assignedToEmail: assignedToEmail || undefined,
    remarks: remarks?.trim() || undefined,
    financeNeeded,
    exchangeNeeded,
    vehicleRegistration: vehicleRegistration?.trim() || undefined,
    subCustomer: subCustomerName
      ? {
          name: String(subCustomerName).trim(),
          mobile: subCustomerMobile?.trim() || String(mobile).trim(),
          vehicleRegistration: vehicleRegistration?.trim() || undefined,
        }
      : undefined,
    referredByCustomerId: referrer?._id,
    referredByMobile: referredByMobile ? String(referredByMobile).trim() : undefined,
    changedBy: req.admin._id,
    historyReason: `Lead created by ${req.admin.name}${assignedTo ? ' and assigned' : ''}${referrer ? ` · referred by ${referrer.name} (${referrer.customerId})` : ''}`,
  });

  await lead.populate(LEAD_POPULATE);
  return successResponse(res, formatCrmLead(lead), 'Lead created successfully', 201, {
    existingCustomer: Boolean(existingCustomer),
    existingCustomerId: existingCustomer?.customerId || null,
    referredBy: referrer ? { customerId: referrer.customerId, name: referrer.name } : null,
  });
});

/**
 * All test drives for the customer behind this lead, with the flags the UI
 * needs to decide whether "Book Test Drive" is available (feature: once a
 * drive is completed, repeats need admin approval).
 */
exports.getLeadTestDrives = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  const state = await getCustomerTestDriveState(lead.mobile);
  const isAdmin = ['manager', 'superadmin'].includes(req.admin.role);

  return successResponse(res, {
    bookings: state.bookings,
    hasCompletedTestDrive: state.hasCompletedTestDrive,
    hasActiveBooking: state.hasActiveBooking,
    hasPendingApproval: state.hasPendingApproval,
    canBookTestDrive: state.canBookTestDrive,
    requiresAdminApproval: state.repeatRequiresAdminApproval && !isAdmin,
  });
});

/**
 * "Book Test Drive" from inside CRM. Multiple test drives are allowed under
 * the same customer profile; a repeat drive (customer already completed one)
 * is auto-approved for managers/admins and goes to PENDING approval when an
 * executive raises it.
 */
exports.bookTestDriveForLead = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  const { slotDate, slotTime, model, remarks, branch } = req.body || {};
  if (!slotDate) throw new ApiError(400, 'slotDate is required');
  if (!slotTime) throw new ApiError(400, 'slotTime is required');

  const nextDate = new Date(slotDate);
  if (Number.isNaN(nextDate.getTime())) throw new ApiError(400, 'Invalid slotDate');
  nextDate.setHours(0, 0, 0, 0);

  const validModels = await getActiveModelNames();
  const chosenModel = String(model || lead.model || '').trim();
  if (!validModels.includes(chosenModel)) {
    throw new ApiError(
      400,
      `Select a specific model for the test drive. Valid models: ${validModels.join(', ')}`,
    );
  }

  const state = await getCustomerTestDriveState(lead.mobile);
  if (state.hasActiveBooking) {
    throw new ApiError(409, 'This customer already has an active test drive booking');
  }

  const isAdmin = ['manager', 'superadmin'].includes(req.admin.role);
  const isRepeat = state.hasCompletedTestDrive;
  const approvalStatus = isRepeat ? (isAdmin ? 'APPROVED' : 'PENDING') : 'NOT_REQUIRED';

  const customer = await upsertTDCustomer({
    name: lead.name,
    mobile: lead.mobile,
    email: lead.email,
    city: lead.city,
  });
  const branchDoc = await resolveBranch(branch);

  // Assign the lead's executive to the booking (or the requesting executive).
  let executive = null;
  const executiveRef = lead.assignedTo || (isExecutiveScopedUser(req.admin) ? req.admin._id : null);
  if (executiveRef) {
    executive = await TDStaff.findById(executiveRef).select('name email');
  }

  const booking = await TDBooking.create({
    bookingId: nextBookingId(),
    bookingStatus: approvalStatus === 'PENDING' ? 'PENDING' : 'CONFIRMED',
    slotDate: nextDate,
    slotTime: normalizeSlotTime(slotTime),
    slotDuration: 60,
    preferredModel: chosenModel,
    remarks: remarks ? String(remarks).trim() : undefined,
    customerId: customer._id,
    branchId: branchDoc._id,
    leadId: lead._id,
    isRepeatDrive: isRepeat,
    approvalStatus,
    approvalRequestedBy: isRepeat ? toObjectId(req.admin._id) || req.admin._id : undefined,
    ...(isRepeat && isAdmin
      ? { approvalDecisionBy: toObjectId(req.admin._id) || req.admin._id, approvalDecidedAt: new Date() }
      : {}),
    customerName: lead.name,
    customerMobile: lead.mobile,
    customerEmail: lead.email,
    customerCity: lead.city,
  });

  if (executive) {
    applyBookingExecutiveAssignment(booking, executive);
    await booking.save();
  }

  const pendingApproval = approvalStatus === 'PENDING';
  if (!pendingApproval) {
    // Move the pipeline forward only for confirmed bookings.
    const prevStage = lead.status;
    if (['Enquiry', 'Interested', 'Test Drive Booked'].includes(normalizeStageLabel(prevStage))) {
      lead.status = 'Test Drive Booked';
    }
    lead.tdBookingId = booking._id;
    touchLeadActivity(lead);
    await lead.save();
    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: booking._id,
      fromStage: prevStage,
      toStage: lead.status,
      changedBy: req.admin._id,
      reason: `Test drive booked (${booking.bookingId})${isRepeat ? ' — repeat drive approved' : ''}`,
    });
  } else {
    touchLeadActivity(lead);
    await lead.save();
    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: booking._id,
      fromStage: lead.status,
      toStage: lead.status,
      changedBy: req.admin._id,
      reason: `Repeat test drive requested (${booking.bookingId}) — awaiting admin approval`,
    });
  }

  await booking.populate([
    { path: 'customerId' },
    { path: 'branchId', select: 'name code' },
    { path: 'assignedExecutive', select: 'name email role designation', model: 'TDStaff' },
  ]);

  return successResponse(
    res,
    { ...formatTdBooking(booking), isRepeat, approvalStatus },
    pendingApproval
      ? 'Repeat test drive request sent for admin approval'
      : 'Test drive booked successfully',
    201,
    { requiresApproval: pendingApproval },
  );
});

/**
 * Convert an opportunity into a sale. When the actual buyer differs from the
 * lead's customer, a new customer record (unique Customer ID) is created for
 * lifecycle tracking and linked as convertedCustomerId.
 */
exports.convertLeadToSale = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  if (lead.convertedAt) {
    throw new ApiError(409, `This opportunity was already converted on ${lead.convertedAt.toLocaleDateString('en-IN')}`);
  }

  const { buyerName, buyerMobile, buyerEmail, buyerCity, vehicleRegistration, stage, remarks } =
    req.body || {};

  const targetStage = stage && ['Booking', 'Delivered'].includes(stage) ? stage : 'Booking';

  let buyer;
  const buyerMobileNorm = buyerMobile ? String(buyerMobile).replace(/\D/g, '').slice(-10) : '';
  const buyerDiffers = buyerMobileNorm && buyerMobileNorm !== lead.mobile;

  if (buyerDiffers) {
    if (!MOBILE_10_REGEX.test(buyerMobileNorm)) {
      throw new ApiError(400, 'Enter a valid 10-digit buyer mobile number');
    }
    // New/existing buyer profile — gets its own unique Customer ID (PVCUSTxxx).
    buyer = await ensureParentCustomer({
      name: buyerName ? String(buyerName).trim() : lead.name,
      mobile: buyerMobileNorm,
      email: buyerEmail || undefined,
      city: buyerCity || lead.city,
    });
  } else {
    buyer = await ensureParentCustomer({
      name: lead.name,
      mobile: lead.mobile,
      email: lead.email,
      city: lead.city,
    });
    if (!lead.pvCustomerId) lead.pvCustomerId = buyer._id;
  }

  const prevStage = lead.status;
  lead.status = targetStage;
  lead.convertedCustomerId = buyer._id;
  lead.convertedAt = new Date();
  lead.convertedBy = toObjectId(req.admin._id) || req.admin._id;
  if (vehicleRegistration) lead.vehicleRegistration = String(vehicleRegistration).trim();
  if (remarks) lead.remarks = String(remarks).trim();
  touchLeadActivity(lead);
  await lead.save();

  await LeadStageHistory.create({
    leadId: lead._id,
    fromStage: prevStage,
    toStage: targetStage,
    changedBy: req.admin._id,
    reason: `Opportunity ${lead.opportunityId || ''} converted to sale — customer ${buyer.customerId} (${buyer.name})${buyerDiffers ? ' · buyer differs from enquirer' : ''}`,
  });

  await lead.populate(LEAD_POPULATE);
  return successResponse(
    res,
    {
      lead: formatCrmLead(lead),
      customer: {
        _id: buyer._id,
        customerId: buyer.customerId,
        name: buyer.name,
        mobile: buyer.mobile,
      },
    },
    `Opportunity converted — customer ${buyer.customerId}`,
  );
});

/**
 * Opportunity ID health check: duplicated opportunity IDs and customers with
 * multiple open opportunities for the same model (managers/admins only).
 */
exports.checkOpportunityDuplicates = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  assertAdminEditRights(req.admin);

  const [duplicateOpportunityIds, multiOpportunityCustomers, missingOpportunityIds] =
    await Promise.all([
      Lead.aggregate([
        { $match: { opportunityId: { $nin: [null, ''] } } },
        { $group: { _id: '$opportunityId', count: { $sum: 1 }, leadIds: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Lead.aggregate([
        { $match: { status: { $nin: ['Delivered', 'Lost', 'Not Interested'] } } },
        {
          $group: {
            _id: { mobile: '$mobile', model: '$model' },
            count: { $sum: 1 },
            opportunities: { $push: { leadId: '$leadId', opportunityId: '$opportunityId', status: '$status' } },
            name: { $first: '$name' },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 100 },
      ]),
      Lead.countDocuments({
        $or: [{ opportunityId: { $exists: false } }, { opportunityId: null }, { opportunityId: '' }],
      }),
    ]);

  return successResponse(res, {
    duplicateOpportunityIds: duplicateOpportunityIds.map((d) => ({
      opportunityId: d._id,
      count: d.count,
      leadIds: d.leadIds,
    })),
    multiOpportunityCustomers: multiOpportunityCustomers.map((d) => ({
      mobile: d._id.mobile,
      model: d._id.model,
      name: d.name,
      count: d.count,
      opportunities: d.opportunities,
    })),
    leadsMissingOpportunityId: missingOpportunityIds,
    healthy: duplicateOpportunityIds.length === 0 && missingOpportunityIds === 0,
  });
});

/**
 * Permanently delete a junk/incorrect CRM lead and its stage/follow-up history.
 * Managers and superadmins only — executives cannot delete.
 */
exports.deleteCrmLead = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  assertAdminEditRights(req.admin);

  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  const ref = lead.leadId || lead.opportunityId || String(lead._id);
  await Promise.all([
    LeadFollowUp.deleteMany({ leadId: lead._id }),
    LeadStageHistory.deleteMany({ leadId: lead._id }),
    lead.deleteOne(),
  ]);

  return successResponse(res, { _id: lead._id, leadId: lead.leadId }, `Lead ${ref} deleted`);
});

module.exports.buildLeadQuery = buildLeadQuery;
module.exports.formatCrmLead = formatCrmLead;
