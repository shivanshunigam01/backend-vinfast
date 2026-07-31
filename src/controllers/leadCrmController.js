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
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { CRM_LEAD_STAGES, isCrmStaffRole, normalizeStageLabel } = require('../constants/leadStages');
const { listAssignableStaff } = require('./tdUsersController');
const {
  toObjectId,
  isCreUser,
  isCreAssignableDesignation,
  isExecutiveScopedUser,
  isTeamScopedUser,
  assignedToStaffFilter,
  assignedToStaffFilterAsync,
  resolveStaffIdsForUser,
  leadAssignedToStaff,
  leadReadableByAdmin,
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
  { path: 'createdBy', select: 'name email role designation' },
  { path: 'pvCustomerId', select: 'customerId name mobile email city isSubCustomer parentCustomer vehicleRegistration' },
  { path: 'subCustomerId', select: 'customerId name mobile vehicleRegistration isSubCustomer' },
];

function assertCrmAccess(admin) {
  if (admin?.userType === 'admin') return;
  if (!isCrmStaffRole(admin.role) && !isCreUser(admin)) {
    throw new ApiError(403, 'Lead CRM access is for executives, managers, and CRE only');
  }
}

function assertCanAssignLeads(admin) {
  if (
    admin?.userType === 'admin' ||
    ['manager', 'superadmin'].includes(admin?.role) ||
    isCreUser(admin)
  ) {
    return;
  }
  throw new ApiError(403, 'Only managers and CRE can assign leads to executives');
}

function assertAdminEditRights(admin) {
  if (
    admin?.userType === 'admin' ||
    ['manager', 'superadmin'].includes(admin?.role) ||
    isCreUser(admin)
  ) {
    return;
  }
  throw new ApiError(403, 'Only managers, admins, and CRE can edit lead details');
}

function isCrmManagerLike(admin) {
  return ['manager', 'superadmin'].includes(admin?.role) || isCreUser(admin);
}

/** Strip designation suffixes like "(SE)" / "(SM)" for name matching. */
function normalizeConsultantName(raw) {
  return String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function resolveSalesConsultant(executiveId, salesConsultant, viewer) {
  if (executiveId) {
    const assignee = await TDStaff.findOne({
      _id: executiveId,
      active: true,
    }).select('_id name email designation role');
    if (!assignee) throw new ApiError(404, 'Staff user not found in User Master or inactive');
    if (isCreUser(viewer) && !isCreAssignableDesignation(assignee.designation)) {
      throw new ApiError(403, 'CRE can only assign leads to Sales Executives or Sales Managers');
    }
    return assignee;
  }

  const needle = normalizeConsultantName(salesConsultant);
  if (!needle || needle === 'un-assigned' || needle === 'unassigned') return null;

  const staff = await TDStaff.find({ active: true })
    .select('_id name email designation role')
    .lean();

  const exact = staff.find((s) => normalizeConsultantName(s.name) === needle);
  if (exact) {
    if (isCreUser(viewer) && !isCreAssignableDesignation(exact.designation)) {
      throw new ApiError(403, 'CRE can only assign leads to Sales Executives or Sales Managers');
    }
    return exact;
  }

  const partial = staff.find((s) => {
    const n = normalizeConsultantName(s.name);
    return n.includes(needle) || needle.includes(n);
  });
  if (partial && isCreUser(viewer) && !isCreAssignableDesignation(partial.designation)) {
    throw new ApiError(403, 'CRE can only assign leads to Sales Executives or Sales Managers');
  }
  return partial || null;
}

function normalizeImportModel(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'VF 7';
  const upper = s.toUpperCase().replace(/\s+/g, ' ');
  if (upper.includes(',') || upper.includes('/')) return 'Both';
  if (upper.includes('LIMO')) return 'Limo Green';
  if (upper.includes('MPV')) return 'VF MPV 7';
  if (upper.includes('VF 6') || upper === 'VF6') return 'VF 6';
  if (upper.includes('VF 7') || upper === 'VF7') return 'VF 7';
  if (upper.includes('VF 3') || upper === 'VF3') return 'VF 7';
  if (isValidLeadModel(s)) return normalizeLeadModelForStorage(s);
  return 'VF 7';
}

function mapLeadTypeToStatus(leadType, status) {
  if (status && CRM_LEAD_STAGES.includes(status)) return status;
  const t = String(leadType || '').trim().toUpperCase();
  if (!t) return 'Enquiry';
  if (t.includes('LOST') || t.includes('NOT INTEREST')) return 'Lost';
  if (t.includes('HOT') || t.includes('WARM')) return 'Interested';
  if (t.includes('COLD') || t.includes('FOLLOW') || t.includes('NOT CONNECT')) return 'Enquiry';
  if (CRM_LEAD_STAGES.includes(leadType)) return leadType;
  return 'Enquiry';
}

async function createOneCrmLeadFromBody(admin, body = {}) {
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
    salesConsultant,
    status,
    leadType,
    enquiryDate,
    callDate,
    existingVariant,
    area,
    address,
    subCustomerName,
    subCustomerMobile,
    vehicleRegistration,
    referredByMobile,
    followUps,
  } = body;

  if (!name || String(name).trim().length < 2) {
    throw new ApiError(400, 'Name is required');
  }
  const mobileNorm = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobileNorm)) {
    throw new ApiError(400, 'Valid 10-digit mobile is required');
  }
  if (!city || !String(city).trim()) {
    throw new ApiError(400, 'City is required');
  }

  let assignedTo = null;
  let assignedToEmail;
  let assignLabel = '';

  if (admin.role === 'executive' && !isCreUser(admin)) {
    assignedTo = toObjectId(admin._id) || admin._id;
    assignedToEmail = admin.email;
    assignLabel = admin.name;
  } else {
    const assignee = await resolveSalesConsultant(executiveId, salesConsultant, admin);
    if (assignee) {
      assignedTo = assignee._id;
      assignedToEmail = assignee.email;
      assignLabel = assignee.name;
    }
  }

  const leadSource =
    source?.trim() ||
    (admin.role === 'executive' && !isCreUser(admin) ? 'Executive' : 'Walk-in');

  let referrer = null;
  if (referredByMobile) {
    referrer = await findCustomerByMobile(referredByMobile);
  }

  const existingCustomer = await findCustomerByMobile(mobileNorm);
  const duplicateLead = await findOpenLeadForCustomer({ mobile: mobileNorm });
  if (duplicateLead) {
    const ref = duplicateLead.leadId || duplicateLead.opportunityId || duplicateLead._id;
    throw new ApiError(
      409,
      `A lead already exists for mobile ${mobileNorm} — ${ref} (stage: ${duplicateLead.status}${
        duplicateLead.assignedToEmail ? `, assigned to ${duplicateLead.assignedToEmail}` : ''
      }).`,
    );
  }

  const modelNorm = normalizeImportModel(model);
  const stage = mapLeadTypeToStatus(leadType, status);
  const leadTypeValue = leadType ? String(leadType).trim() : undefined;
  const areaValue = String(area || city || '').trim() || undefined;
  const addressValue = String(address || '').trim() || undefined;

  const remarkParts = [];
  if (remarks) remarkParts.push(String(remarks).trim());
  if (existingVariant && String(existingVariant).trim().toUpperCase() !== 'NO') {
    remarkParts.push(`Existing variant: ${String(existingVariant).trim()}`);
  }
  if (enquiryDate) remarkParts.push(`Enquiry date: ${String(enquiryDate).trim()}`);
  if (callDate) remarkParts.push(`Call date: ${String(callDate).trim()}`);
  if (model && normalizeImportModel(model) !== String(model).trim()) {
    remarkParts.push(`Excel model: ${String(model).trim()}`);
  }

  const { lead } = await intakePvLead({
    name: String(name).trim(),
    mobile: mobileNorm,
    email: email && String(email).trim().toLowerCase() !== 'no' ? email : undefined,
    city: String(city).trim(),
    otherCity: otherCity?.trim() || undefined,
    model: modelNorm,
    interest: interest?.trim() || undefined,
    source: leadSource,
    status: stage,
    assignedTo: assignedTo || undefined,
    assignedToEmail: assignedToEmail || undefined,
    remarks: remarkParts.filter(Boolean).join('\n') || undefined,
    financeNeeded,
    exchangeNeeded,
    vehicleRegistration: vehicleRegistration?.trim() || undefined,
    createdBy: admin._id,
    leadType: leadTypeValue,
    area: areaValue,
    address: addressValue,
    subCustomer: subCustomerName
      ? {
          name: String(subCustomerName).trim(),
          mobile: subCustomerMobile?.trim() || mobileNorm,
          vehicleRegistration: vehicleRegistration?.trim() || undefined,
        }
      : undefined,
    referredByCustomerId: referrer?._id,
    referredByMobile: referredByMobile ? String(referredByMobile).trim() : undefined,
    changedBy: admin._id,
    historyReason: `Lead created by ${admin.name}${assignedTo ? ` and assigned to ${assignLabel}` : ''}${
      referrer ? ` · referred by ${referrer.name} (${referrer.customerId})` : ''
    }`,
  });

  if (Array.isArray(followUps) && followUps.length) {
    for (const fu of followUps.slice(0, 12)) {
      const note = String(fu?.note || '').trim();
      if (!note) continue;
      let scheduled = null;
      if (fu.scheduledAt) {
        const d = new Date(fu.scheduledAt);
        if (!Number.isNaN(d.getTime())) scheduled = d;
      }
      const isCompleted = !scheduled || scheduled <= new Date();
      await LeadFollowUp.create({
        leadId: lead._id,
        createdBy: admin._id,
        note,
        scheduledAt: scheduled || undefined,
        completedAt: isCompleted ? new Date() : undefined,
        status: isCompleted ? 'completed' : 'pending',
      });
      if (scheduled && !isCompleted) {
        lead.nextFollowUp = scheduled;
      }
    }
    touchLeadActivity(lead);
    await lead.save();
  }

  await lead.populate(LEAD_POPULATE);
  return {
    lead,
    existingCustomer: Boolean(existingCustomer),
    existingCustomerId: existingCustomer?.customerId || null,
    referredBy: referrer ? { customerId: referrer.customerId, name: referrer.name } : null,
    assignLabel,
  };
}

async function assertLeadReadable(lead, admin) {
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (isTeamScopedUser(admin)) {
    const ok = await leadReadableByAdmin(lead, admin);
    if (!ok) throw new ApiError(403, 'This lead is not in your team');
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
  // MoM #12: SE/SM/SH/BM see own + reporting subtree; MD/CEO/GM/superadmin see all.
  // Team-scoped users may further narrow with ?assignedTo= (self / SE in subtree / unassigned).
  if (isTeamScopedUser(admin)) {
    query.$and = query.$and || [];
    query.$and.push(await assignedToStaffFilterAsync(admin));

    if (queryParams.assignedTo) {
      if (queryParams.assignedTo === 'unassigned') {
        query.$and.push({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] });
      } else if (queryParams.assignedTo === 'me') {
        query.$and.push(assignedToStaffFilter(admin._id, admin.email));
      } else {
        const allowedIds = await resolveStaffIdsForUser(admin);
        if (!allowedIds.includes(String(queryParams.assignedTo))) {
          query.$and.push({ _id: null });
        } else {
          const assignee = await TDStaff.findById(queryParams.assignedTo).select('email').lean();
          query.$and.push(assignedToStaffFilter(queryParams.assignedTo, assignee?.email));
        }
      }
    }
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
  if (queryParams.city) query.city = new RegExp(`^${String(queryParams.city).trim()}$`, 'i');
  if (queryParams.area) {
    const areaRx = new RegExp(String(queryParams.area).trim(), 'i');
    query.$and = query.$and || [];
    query.$and.push({ $or: [{ area: areaRx }, { city: areaRx }] });
  }
  if (queryParams.leadType) query.leadType = new RegExp(String(queryParams.leadType).trim(), 'i');
  if (queryParams.address) query.address = new RegExp(String(queryParams.address).trim(), 'i');
  if (queryParams.createdBy) query.createdBy = queryParams.createdBy;
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
        { area: regex },
        { address: regex },
        { leadType: regex },
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
  // Backfill missing assignedToEmail for this user only (safe for SM + SE).
  if (isTeamScopedUser(req.admin)) {
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
  await assertLeadReadable(lead, req.admin);
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

  const isAdmin = isCrmManagerLike(req.admin);
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
  await assertLeadReadable(lead, req.admin);

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
    area,
    address,
    leadType,
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
  applyString('area', 'Area', area);
  applyString('address', 'Address', address);
  applyString('leadType', 'Lead type', leadType);
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
  await assertLeadReadable(lead, req.admin);

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
  await assertLeadReadable(lead, req.admin);

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
  await assertLeadReadable(lead, req.admin);

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
  const data = await listAssignableStaff(req.admin);
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
    }).select('name email role designation');
    if (!assignee) throw new ApiError(404, 'Staff user not found in User Master or inactive');
    if (isCreUser(req.admin) && !isCreAssignableDesignation(assignee.designation)) {
      throw new ApiError(403, 'CRE can only assign leads to Sales Executives or Sales Managers');
    }
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

  const result = await createOneCrmLeadFromBody(req.admin, req.body);
  return successResponse(res, formatCrmLead(result.lead), 'Lead created successfully', 201, {
    existingCustomer: result.existingCustomer,
    existingCustomerId: result.existingCustomerId,
    referredBy: result.referredBy,
  });
});

/**
 * Bulk import CRE "Current Format" Excel rows into Lead CRM.
 * POST /admin/crm/leads/bulk  { leads: [...] }
 */
exports.bulkCreateCrmLeads = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  if (!isCrmManagerLike(req.admin) && req.admin.role !== 'executive') {
    throw new ApiError(403, 'Not allowed to bulk import leads');
  }

  const leads = req.body?.leads;
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new ApiError(400, 'Provide a non-empty "leads" array.');
  }
  if (leads.length > 500) {
    throw new ApiError(400, 'Maximum 500 leads per import.');
  }

  const results = { created: 0, failed: [] };
  for (let i = 0; i < leads.length; i += 1) {
    const row = leads[i];
    try {
      await createOneCrmLeadFromBody(req.admin, row);
      results.created += 1;
    } catch (err) {
      results.failed.push({
        row: i + 1,
        name: row?.name,
        mobile: row?.mobile,
        message: err?.message || 'Failed to import row',
      });
    }
  }

  return successResponse(
    res,
    results,
    `Imported ${results.created} of ${leads.length} lead(s)`,
    200,
    { total: leads.length, failed: results.failed.length },
  );
});

/**
 * All test drives for the customer behind this lead, with the flags the UI
 * needs to decide whether "Book Test Drive" is available (feature: once a
 * drive is completed, repeats need admin approval).
 */
exports.getLeadTestDrives = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const lead = await Lead.findById(req.params.id);
  await assertLeadReadable(lead, req.admin);

  const state = await getCustomerTestDriveState(lead.mobile);
  const isAdmin = isCrmManagerLike(req.admin);

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
  await assertLeadReadable(lead, req.admin);

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

  const isAdmin = isCrmManagerLike(req.admin);
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
  await assertLeadReadable(lead, req.admin);

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

const XLSX = require('xlsx');
const { normalizeMobile, mobileVariants } = require('../utils/mobile');
const { nextLeadId, nextOpportunityId } = require('../utils/pvIdGenerator');
const {
  isCurrentFormatSheet,
  parseCurrentFormatRow,
  pickForwardStage,
  normalizeImportModel: normalizeCreImportModel,
} = require('../utils/creCurrentFormatImport');

const CLOSED_STATUSES = ['Lost', 'Delivered', 'Not Interested'];

function cellStr(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function parseSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function headerKey(row, aliases) {
  const map = {};
  for (const [k, v] of Object.entries(row)) {
    map[String(k).trim().toLowerCase().replace(/\s+/g, ' ')] = v;
  }
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (map[key] != null && cellStr(map[key]) !== '') return cellStr(map[key]);
    for (const [hk, hv] of Object.entries(map)) {
      if (hk === key || hk.includes(key)) return cellStr(hv);
    }
  }
  return '';
}

/**
 * GET /admin/crm/leads/export — Excel with Leads + FollowUps sheets.
 */
exports.exportCrmLeads = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);

  const query = await buildLeadQuery(req.admin, req.query);
  const leads = await Lead.find(query)
    .populate(LEAD_POPULATE)
    .sort(CRM_LEAD_LIST_SORT)
    .limit(5000)
    .lean();

  const leadIds = leads.map((l) => l._id);
  const followUps = await LeadFollowUp.find({ leadId: { $in: leadIds } })
    .sort({ createdAt: 1 })
    .lean();

  const leadById = new Map(leads.map((l) => [String(l._id), l]));

  const leadRows = leads.map((l) => ({
    LeadId: l.leadId || '',
    OpportunityId: l.opportunityId || '',
    Name: l.name || '',
    Mobile: l.mobile || '',
    Email: l.email || '',
    City: l.city || '',
    Model: l.model || '',
    Source: l.source || '',
    Status: l.status || '',
    Remarks: l.remarks || '',
    AssignedToEmail: l.assignedToEmail || l.assignedTo?.email || '',
    AssignedToName: l.assignedTo?.name || '',
    NextFollowUp: l.nextFollowUp ? new Date(l.nextFollowUp).toISOString() : '',
    FinanceNeeded: l.financeNeeded ? 'Yes' : 'No',
    ExchangeNeeded: l.exchangeNeeded ? 'Yes' : 'No',
    CreatedAt: l.createdAt ? new Date(l.createdAt).toISOString() : '',
  }));

  const followUpRows = followUps.map((f) => {
    const lead = leadById.get(String(f.leadId));
    return {
      LeadId: lead?.leadId || '',
      Mobile: lead?.mobile || '',
      Note: f.note || '',
      ScheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : '',
      CompletedAt: f.completedAt ? new Date(f.completedAt).toISOString() : '',
      Outcome: f.outcome || '',
      Status: f.status || '',
      CreatedAt: f.createdAt ? new Date(f.createdAt).toISOString() : '',
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadRows), 'Leads');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(followUpRows), 'FollowUps');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const filename = `crm-leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(buffer);
});

async function findLeadByMobileAndModel(mobile, modelNorm) {
  const variants = mobileVariants(mobile);
  const candidates = await Lead.find({
    mobile: { $in: variants.length ? variants : [mobile] },
  })
    .sort({ createdAt: -1 })
    .limit(50);

  const match = candidates.find(
    (l) => normalizeCreImportModel(l.model) === modelNorm || String(l.model || '').trim() === modelNorm,
  );
  return match || null;
}

async function syncImportFollowUps(lead, followUps, admin, results) {
  if (!Array.isArray(followUps) || !followUps.length) return;

  const existing = await LeadFollowUp.find({ leadId: lead._id }).select('note scheduledAt').lean();
  const existingKeys = new Set(
    existing.map((f) => {
      const day = f.scheduledAt ? new Date(f.scheduledAt).toISOString().slice(0, 10) : '';
      return `${String(f.note || '').trim().toLowerCase()}|${day}`;
    }),
  );

  let nextPending = lead.nextFollowUp ? new Date(lead.nextFollowUp) : null;

  for (const fu of followUps.slice(0, 12)) {
    const note = String(fu?.note || '').trim();
    if (!note) continue;
    let scheduled = null;
    if (fu.scheduledAt) {
      const d = new Date(fu.scheduledAt);
      if (!Number.isNaN(d.getTime())) scheduled = d;
    }
    const day = scheduled ? scheduled.toISOString().slice(0, 10) : '';
    const key = `${note.toLowerCase()}|${day}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    const isCompleted = !scheduled || scheduled <= new Date();
    await LeadFollowUp.create({
      leadId: lead._id,
      createdBy: admin._id,
      note,
      scheduledAt: scheduled || undefined,
      completedAt: isCompleted ? new Date() : undefined,
      status: isCompleted ? 'completed' : 'pending',
    });
    results.followUpsCreated += 1;

    if (scheduled && !isCompleted) {
      if (!nextPending || scheduled < nextPending) nextPending = scheduled;
    }
  }

  if (nextPending) {
    lead.nextFollowUp = nextPending;
  }
}

/**
 * CRE Current Format upsert: match by mobile + model; store creSheet; stage forward only.
 */
function pushImportRow(results, entry) {
  if (!Array.isArray(results.rows)) results.rows = [];
  results.rows.push(entry);
}

async function importCurrentFormatRows(admin, leadRows) {
  const results = { created: 0, updated: 0, failed: [], followUpsCreated: 0, rows: [] };
  const seenInBatch = new Set();

  for (let i = 0; i < leadRows.length; i += 1) {
    const raw = leadRows[i];
    const rowNum = i + 2;
    let parsed;
    try {
      parsed = parseCurrentFormatRow(raw);
      const { name, mobile, model } = parsed;
      if (!name || String(name).trim().length < 2) {
        throw new Error('Customer name is required');
      }
      if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
        throw new Error('Valid 10-digit mobile (PHONE) is required');
      }

      const batchKey = `${mobile}|${model}`;
      if (seenInBatch.has(batchKey)) {
        throw new Error(`Duplicate mobile + model within this import file (${mobile} / ${model})`);
      }
      seenInBatch.add(batchKey);

      let assignedTo = null;
      let assignedToEmail;
      let assignLabel = '';
      if (admin.role === 'executive' && !isCreUser(admin)) {
        assignedTo = toObjectId(admin._id) || admin._id;
        assignedToEmail = admin.email;
        assignLabel = admin.name;
      } else if (parsed.salesConsultant) {
        const assignee = await resolveSalesConsultant(null, parsed.salesConsultant, admin);
        if (assignee) {
          assignedTo = assignee._id;
          assignedToEmail = assignee.email;
          assignLabel = assignee.name;
        }
      }

      const modelForStorage = normalizeLeadModelForStorage(model);
      if (!isValidLeadModel(modelForStorage)) {
        throw new Error(`Invalid model: ${parsed.modelRaw || model}`);
      }

      let lead = await findLeadByMobileAndModel(mobile, model);
      const incomingStatus = parsed.derivedStatus || 'Enquiry';
      const isNew = !lead;

      if (isNew) {
        const parent = await ensureParentCustomer({
          name,
          mobile,
          email: parsed.email,
          city: parsed.city,
        });
        lead = await Lead.create({
          leadId: await nextLeadId(),
          opportunityId: await nextOpportunityId(),
          pvCustomerId: parent._id,
          name: String(name).trim(),
          mobile,
          email: parsed.email || undefined,
          city: String(parsed.city || 'Patna').trim(),
          area: String(parsed.area || parsed.city || '').trim() || undefined,
          model: modelForStorage,
          source: parsed.source || 'Excel Import',
          status: incomingStatus,
          leadType: parsed.leadType || undefined,
          remarks: parsed.remarks || undefined,
          exchangeNeeded: Boolean(parsed.exchangeNeeded),
          assignedTo: assignedTo || undefined,
          assignedToEmail: assignedToEmail || undefined,
          createdBy: admin._id,
          creSheet: parsed.creSheet || undefined,
          lastActivityAt: new Date(),
        });
        await LeadStageHistory.create({
          leadId: lead._id,
          toStage: incomingStatus,
          changedBy: admin._id,
          reason: `Lead imported from Current Format Excel by ${admin.name}${
            assignLabel ? ` · assigned to ${assignLabel}` : ''
          }`,
        });
        results.created += 1;
        pushImportRow(results, {
          row: rowNum,
          status: 'created',
          name: String(name).trim(),
          mobile,
          model: modelForStorage,
          leadId: lead.leadId || String(lead._id),
          message: 'New lead created',
        });
      } else {
        const prevStage = lead.status;
        const nextStage = pickForwardStage(prevStage, incomingStatus);

        lead.name = String(name).trim();
        if (parsed.email) lead.email = parsed.email;
        lead.city = String(parsed.city || lead.city || 'Patna').trim();
        lead.area = String(parsed.area || parsed.city || lead.area || '').trim() || lead.area;
        lead.model = modelForStorage;
        if (parsed.source) lead.source = parsed.source;
        if (parsed.leadType) lead.leadType = parsed.leadType;
        if (parsed.remarks) lead.remarks = parsed.remarks;
        lead.exchangeNeeded = Boolean(parsed.exchangeNeeded);
        if (assignedTo) {
          lead.assignedTo = assignedTo;
          lead.assignedToEmail = assignedToEmail;
        }
        lead.creSheet = { ...(lead.creSheet?.toObject?.() || lead.creSheet || {}), ...parsed.creSheet };
        lead.status = nextStage;
        touchLeadActivity(lead);
        await lead.save();

        if (normalizeStageLabel(prevStage) !== normalizeStageLabel(nextStage)) {
          await LeadStageHistory.create({
            leadId: lead._id,
            fromStage: prevStage,
            toStage: nextStage,
            changedBy: admin._id,
            reason: `Stage updated from Current Format Excel by ${admin.name}`,
          });
        }
        results.updated += 1;
        const stageNote =
          normalizeStageLabel(prevStage) !== normalizeStageLabel(nextStage)
            ? `Updated · stage ${prevStage} → ${nextStage}`
            : 'Existing lead updated';
        pushImportRow(results, {
          row: rowNum,
          status: 'updated',
          name: String(name).trim(),
          mobile,
          model: modelForStorage,
          leadId: lead.leadId || String(lead._id),
          message: stageNote,
        });
      }

      await syncImportFollowUps(lead, parsed.followUps, admin, results);
      touchLeadActivity(lead);
      await lead.save();
    } catch (err) {
      const fail = {
        row: rowNum,
        name: parsed?.name || cellStr(raw?.['CUSTOMER NAME'] ?? raw?.name) || '',
        mobile: parsed?.mobile || cellStr(raw?.PHONE ?? raw?.phone) || '',
        message: err?.message || 'Failed to import row',
      };
      results.failed.push(fail);
      pushImportRow(results, {
        ...fail,
        status: 'failed',
        model: parsed?.model || cellStr(raw?.['EXISTING VARIANT'] ?? raw?.model) || '',
      });
    }
  }

  return results;
}

/**
 * POST /admin/crm/leads/import
 * Body JSON: { leads: [...], followUps: [...] } OR multipart file.
 * Auto-detects CRE Current Format (upsert by mobile + model) vs simple create-only import.
 */
exports.importCrmLeads = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);

  let leadRows = [];
  let followUpRows = [];

  if (req.file?.buffer) {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetNames = workbook.SheetNames || [];
    const leadsSheet =
      sheetNames.find((n) => /^leads?$/i.test(n)) ||
      sheetNames[0];
    const followSheet = sheetNames.find((n) => /follow/i.test(n));
    leadRows = parseSheetRows(workbook, leadsSheet);
    if (followSheet) followUpRows = parseSheetRows(workbook, followSheet);
  } else {
    leadRows = Array.isArray(req.body?.leads) ? req.body.leads : [];
    followUpRows = Array.isArray(req.body?.followUps) ? req.body.followUps : [];
  }

  if (!leadRows.length) {
    throw new ApiError(400, 'No lead rows found to import. Provide a Leads sheet or leads array.');
  }
  if (leadRows.length > 500) {
    throw new ApiError(400, 'Maximum 500 leads per import.');
  }

  if (isCurrentFormatSheet(leadRows)) {
    const results = await importCurrentFormatRows(req.admin, leadRows);
    return successResponse(
      res,
      results,
      `Imported ${results.created} created, ${results.updated} updated, ${results.followUpsCreated} follow-up(s). ${results.failed.length} failed.`,
      200,
      { total: leadRows.length, failed: results.failed.length, format: 'current' },
    );
  }

  const results = { created: 0, updated: 0, failed: [], followUpsCreated: 0, rows: [] };
  /** mobile (normalized) -> created lead _id for follow-up linking in this batch */
  const createdByMobile = new Map();
  const seenInBatch = new Set();

  for (let i = 0; i < leadRows.length; i += 1) {
    const raw = leadRows[i];
    const rowNum = i + 2; // header + 1-based
    try {
      const name =
        cellStr(raw.name ?? raw.Name) ||
        headerKey(raw, ['name', 'customer name', 'full name', 'lead name']);
      const mobileRaw =
        cellStr(raw.mobile ?? raw.Mobile) ||
        headerKey(raw, ['mobile', 'phone', 'contact', 'mobile number']);
      const mobile = normalizeMobile(mobileRaw) || mobileRaw.replace(/\D/g, '').slice(-10);

      if (!name || !mobile) {
        throw new Error('Name and Mobile are required');
      }
      if (seenInBatch.has(mobile)) {
        throw new Error('Duplicate mobile within this import file');
      }
      seenInBatch.add(mobile);

      const variants = mobileVariants(mobile);
      const existing = await Lead.findOne({
        mobile: { $in: variants.length ? variants : [mobile] },
      }).sort({ createdAt: -1 });
      if (existing) {
        throw new Error(
          `Duplicate mobile — lead already exists (${existing.leadId || existing.opportunityId || existing._id}, stage: ${existing.status})`,
        );
      }

      const email =
        cellStr(raw.email ?? raw.Email) || headerKey(raw, ['email', 'email id']) || undefined;
      const city =
        cellStr(raw.city ?? raw.City) || headerKey(raw, ['city', 'state', 'location']) || 'Patna';
      const model =
        cellStr(raw.model ?? raw.Model) ||
        headerKey(raw, ['model', 'interested model', 'vehicle']) ||
        'VF 7';
      const source =
        cellStr(raw.source ?? raw.Source) || headerKey(raw, ['source', 'lead source']) || 'Excel Import';
      const status =
        cellStr(raw.status ?? raw.Status) || headerKey(raw, ['status', 'lead status']) || 'Enquiry';
      const remarks =
        cellStr(raw.remarks ?? raw.Remarks) || headerKey(raw, ['remarks', 'notes']) || undefined;
      const assignedToEmail =
        cellStr(raw.assignedToEmail ?? raw.AssignedToEmail) ||
        headerKey(raw, ['assigned to email', 'assignee email']) ||
        undefined;

      let assignedTo = null;
      let assignedEmail = assignedToEmail;
      if (assignedToEmail) {
        const staff = await TDStaff.findOne({
          email: String(assignedToEmail).trim().toLowerCase(),
          active: true,
        }).select('_id email');
        if (staff) {
          assignedTo = staff._id;
          assignedEmail = staff.email;
        }
      } else if (req.admin.role === 'executive') {
        assignedTo = toObjectId(req.admin._id) || req.admin._id;
        assignedEmail = req.admin.email;
      }

      const financeRaw =
        cellStr(raw.financeNeeded ?? raw.FinanceNeeded) || headerKey(raw, ['finance', 'finance needed']);
      const exchangeRaw =
        cellStr(raw.exchangeNeeded ?? raw.ExchangeNeeded) ||
        headerKey(raw, ['exchange', 'exchange needed']);

      const modelForStorage = normalizeLeadModelForStorage(model);
      const { lead } = await intakePvLead({
        name,
        mobile,
        email,
        city,
        model: modelForStorage,
        source,
        status: normalizeStageLabel(status) || 'Enquiry',
        remarks,
        assignedTo: assignedTo || undefined,
        assignedToEmail: assignedEmail || undefined,
        financeNeeded: /^(yes|y|true|1)$/i.test(financeRaw),
        exchangeNeeded: /^(yes|y|true|1)$/i.test(exchangeRaw),
        changedBy: req.admin._id,
        historyReason: `Lead imported from Excel by ${req.admin.name}`,
      });

      createdByMobile.set(mobile, lead._id);
      results.created += 1;
      pushImportRow(results, {
        row: rowNum,
        status: 'created',
        name: String(name).trim(),
        mobile,
        model: modelForStorage,
        leadId: lead.leadId || String(lead._id),
        message: 'New lead created',
      });

      // Optional next follow-up date on lead row
      const nextFu =
        cellStr(raw.nextFollowUp ?? raw.NextFollowUp) || headerKey(raw, ['next follow up', 'next followup']);
      if (nextFu) {
        const d = new Date(nextFu);
        if (!Number.isNaN(d.getTime())) {
          lead.nextFollowUp = d;
          await lead.save();
        }
      }
    } catch (err) {
      const fail = {
        row: rowNum,
        name: cellStr(raw?.name ?? raw?.Name) || headerKey(raw || {}, ['name']),
        mobile: cellStr(raw?.mobile ?? raw?.Mobile) || headerKey(raw || {}, ['mobile', 'phone']),
        message: err?.message || 'Failed to import row',
      };
      results.failed.push(fail);
      pushImportRow(results, {
        ...fail,
        status: 'failed',
        model:
          cellStr(raw?.model ?? raw?.Model) ||
          headerKey(raw || {}, ['model', 'interested model', 'vehicle']) ||
          '',
      });
    }
  }

  // Import follow-ups linked by Mobile or LeadId
  for (let i = 0; i < followUpRows.length; i += 1) {
    const raw = followUpRows[i];
    try {
      const note =
        cellStr(raw.note ?? raw.Note) || headerKey(raw, ['note', 'follow up note', 'remarks']);
      if (!note) continue;
      const mobileRaw =
        cellStr(raw.mobile ?? raw.Mobile) || headerKey(raw, ['mobile', 'phone']);
      const mobile = normalizeMobile(mobileRaw) || mobileRaw.replace(/\D/g, '').slice(-10);
      const leadIdCode =
        cellStr(raw.leadId ?? raw.LeadId) || headerKey(raw, ['lead id', 'leadid']);

      let leadDoc = null;
      if (mobile && createdByMobile.has(mobile)) {
        leadDoc = await Lead.findById(createdByMobile.get(mobile));
      }
      if (!leadDoc && leadIdCode) {
        leadDoc = await Lead.findOne({ leadId: leadIdCode });
      }
      if (!leadDoc && mobile) {
        leadDoc = await Lead.findOne({ mobile, status: { $nin: CLOSED_STATUSES } }).sort({
          createdAt: -1,
        });
      }
      if (!leadDoc) {
        throw new Error(`No lead found for follow-up (mobile: ${mobile || '—'}, leadId: ${leadIdCode || '—'})`);
      }

      const scheduledAtRaw =
        cellStr(raw.scheduledAt ?? raw.ScheduledAt) || headerKey(raw, ['scheduled at', 'scheduled']);
      const completedAtRaw =
        cellStr(raw.completedAt ?? raw.CompletedAt) || headerKey(raw, ['completed at', 'completed']);
      const outcome =
        cellStr(raw.outcome ?? raw.Outcome) || headerKey(raw, ['outcome']) || undefined;
      const fuStatus =
        cellStr(raw.status ?? raw.Status) || headerKey(raw, ['status']) || 'pending';

      const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : undefined;
      const completedAt = completedAtRaw ? new Date(completedAtRaw) : undefined;
      const normalizedFuStatus = ['pending', 'completed', 'cancelled'].includes(
        String(fuStatus || '').toLowerCase(),
      )
        ? String(fuStatus).toLowerCase()
        : 'pending';

      await LeadFollowUp.create({
        leadId: leadDoc._id,
        createdBy: req.admin._id || req.tdStaff?._id,
        note,
        scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : undefined,
        completedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : undefined,
        outcome,
        status: normalizedFuStatus,
      });
      results.followUpsCreated += 1;

      // Keep lead.nextFollowUp in sync with the soonest pending scheduled follow-up.
      if (
        normalizedFuStatus === 'pending' &&
        scheduledAt &&
        !Number.isNaN(scheduledAt.getTime())
      ) {
        if (!leadDoc.nextFollowUp || scheduledAt < new Date(leadDoc.nextFollowUp)) {
          leadDoc.nextFollowUp = scheduledAt;
          await leadDoc.save();
        }
      }
    } catch (err) {
      const fail = {
        row: `FollowUp:${i + 2}`,
        name: '',
        mobile: cellStr(raw?.mobile ?? raw?.Mobile) || '',
        message: err?.message || 'Failed to import follow-up',
      };
      results.failed.push(fail);
      pushImportRow(results, { ...fail, status: 'failed', model: '' });
    }
  }

  return successResponse(
    res,
    results,
    `Imported ${results.created} lead(s), ${results.followUpsCreated} follow-up(s). ${results.failed.length} failed.`,
    200,
    { total: leadRows.length, failed: results.failed.length },
  );
});

/**
 * POST /admin/crm/leads/bulk-delete — delete multiple junk leads at once.
 */
exports.bulkDeleteCrmLeads = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  assertAdminEditRights(req.admin);

  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) throw new ApiError(400, 'Provide a non-empty "ids" array');
  if (ids.length > 100) throw new ApiError(400, 'Maximum 100 leads per bulk delete');

  const leads = await Lead.find({ _id: { $in: ids } });
  const foundIds = leads.map((l) => l._id);
  await Promise.all([
    LeadFollowUp.deleteMany({ leadId: { $in: foundIds } }),
    LeadStageHistory.deleteMany({ leadId: { $in: foundIds } }),
    Lead.deleteMany({ _id: { $in: foundIds } }),
  ]);

  return successResponse(
    res,
    { deleted: foundIds.length, requested: ids.length },
    `Deleted ${foundIds.length} lead(s)`,
  );
});

module.exports.buildLeadQuery = buildLeadQuery;
module.exports.formatCrmLead = formatCrmLead;
