require('../models/tdModels');
require('../models/PVCustomer');
require('../models/Counter');

const Lead = require('../models/Lead');
const { normalizeLeadModelForStorage } = require('../utils/leadModel');
const { intakePvLead } = require('../utils/pvLeadIntake');
const { assignPvIds } = require('../utils/pvLeadIntake');
const LeadStageHistory = require('../models/LeadStageHistory');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDStaff = require('../models/TDStaff');
const { STAFF_DESIGNATIONS } = require('../models/TDStaff');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { CRM_LEAD_STAGES, isCrmStaffRole } = require('../constants/leadStages');
const { listAssignableStaff } = require('./tdUsersController');
const {
  toObjectId,
  isExecutiveScopedUser,
  assignedToStaffFilter,
  assignedToStaffFilterAsync,
  leadAssignedToStaff,
  applyLeadAssignment,
  repairExecutiveLeadAssignments,
  touchLeadActivity,
  CRM_LEAD_LIST_SORT,
} = require('../utils/leadAssignment');

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
    query.createdAt = {};
    if (queryParams.from) query.createdAt.$gte = new Date(queryParams.from);
    if (queryParams.to) query.createdAt.$lte = new Date(`${queryParams.to}T23:59:59.999Z`);
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

  const [history, followUps, siblingLeads] = await Promise.all([
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
  ]);

  return successResponse(res, {
    lead: formatCrmLead(lead),
    history,
    followUps,
    siblingLeads,
    stages: CRM_LEAD_STAGES,
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
    changedBy: req.admin._id,
    historyReason: `Lead created by ${req.admin.name}${assignedTo ? ' and assigned' : ''}`,
  });

  await lead.populate(LEAD_POPULATE);
  return successResponse(res, formatCrmLead(lead), 'Lead created successfully', 201);
});

module.exports.buildLeadQuery = buildLeadQuery;
module.exports.formatCrmLead = formatCrmLead;
