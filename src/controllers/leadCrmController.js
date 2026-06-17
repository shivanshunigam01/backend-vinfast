require('../models/tdModels');

const Lead = require('../models/Lead');
const { normalizeLeadModelForStorage } = require('../utils/leadModel');
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
  if (admin.role === 'executive') {
    const assigned = lead.assignedTo?._id || lead.assignedTo;
    if (!assigned || String(assigned) !== String(admin._id)) {
      throw new ApiError(403, 'This lead is not assigned to you');
    }
  }
}

function buildLeadQuery(admin, queryParams = {}) {
  const query = {};
  if (admin.role === 'executive') {
    query.assignedTo = admin._id;
  } else if (queryParams.assignedTo) {
    if (queryParams.assignedTo === 'unassigned') {
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] });
    } else {
      query.assignedTo = queryParams.assignedTo;
    }
  } else if (queryParams.mine === 'true') {
    query.assignedTo = admin._id;
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
      $or: [{ name: regex }, { mobile: regex }, { email: regex }, { city: regex }, { remarks: regex }],
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
  const { page, limit, skip } = buildPagination(req);
  const query = buildLeadQuery(req.admin, req.query);

  const [docs, total] = await Promise.all([
    Lead.find(query)
      .populate('assignedTo', 'name email role designation')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Lead.countDocuments(query),
  ]);

  return successResponse(res, docs, undefined, 200, { page, limit, total, stages: CRM_LEAD_STAGES });
});

exports.getCrmLeadDetail = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email role designation');
  assertLeadReadable(lead, req.admin);

  const [history, followUps] = await Promise.all([
    LeadStageHistory.find({ leadId: lead._id })
      .populate('changedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(50),
    LeadFollowUp.find({ leadId: lead._id })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100),
  ]);

  return successResponse(res, { lead, history, followUps, stages: CRM_LEAD_STAGES });
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
    return successResponse(res, lead, 'Stage unchanged');
  }

  lead.status = stage;
  await lead.save();

  await LeadStageHistory.create({
    leadId: lead._id,
    fromStage: prevStage,
    toStage: stage,
    changedBy: req.admin._id,
    reason: reason || `Stage updated to ${stage}`,
  });

  await lead.populate('assignedTo', 'name email role designation');
  return successResponse(res, lead, `Lead moved to ${stage}`);
});

exports.updateLeadRemarks = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { remarks } = req.body;
  if (remarks == null) throw new ApiError(400, 'Remarks are required');

  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  lead.remarks = String(remarks).trim();
  await lead.save();
  await lead.populate('assignedTo', 'name email role designation');

  return successResponse(res, lead, 'Remarks saved');
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
    await lead.save();
  }

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

  const update = executiveId
    ? { $set: { assignedTo: executiveId } }
    : { $unset: { assignedTo: '' } };

  await Lead.updateOne({ _id: lead._id }, update);

  const updated = await Lead.findById(lead._id).populate('assignedTo', 'name email role designation');
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
    updated,
    executiveId ? `Lead assigned to ${assignLabel}` : 'Lead unassigned',
  );
});

exports.getCrmStages = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  return successResponse(res, CRM_LEAD_STAGES);
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
  } = req.body;

  let assignedTo = null;

  if (req.admin.role === 'executive') {
    assignedTo = req.admin._id;
  } else if (executiveId) {
    const assignee = await TDStaff.findOne({
      _id: executiveId,
      active: true,
      designation: { $in: STAFF_DESIGNATIONS },
    }).select('_id name');
    if (!assignee) throw new ApiError(404, 'Staff user not found in User Master or inactive');
    assignedTo = assignee._id;
  }

  const leadSource =
    source?.trim() ||
    (req.admin.role === 'executive' ? 'Executive' : 'Walk-in');

  const lead = await Lead.create({
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
    remarks: remarks?.trim() || undefined,
    financeNeeded: Boolean(financeNeeded),
    exchangeNeeded: Boolean(exchangeNeeded),
  });

  const assignNote = assignedTo
    ? ` · assigned to ${req.admin.role === 'executive' ? 'self' : 'executive'}`
    : '';

  await LeadStageHistory.create({
    leadId: lead._id,
    toStage: 'Enquiry',
    changedBy: req.admin._id,
    reason: `Lead created by ${req.admin.name}${assignNote}`,
  });

  await lead.populate('assignedTo', 'name email role designation');
  return successResponse(res, lead, 'Lead created successfully', 201);
});

module.exports.buildLeadQuery = buildLeadQuery;
