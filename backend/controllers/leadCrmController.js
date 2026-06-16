const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const LeadFollowUp = require('../models/LeadFollowUp');
const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');
const { CRM_LEAD_STAGES, isCrmStaffRole } = require('../constants/leadStages');
const { fetchAssignableStaff } = require('./tdStaffController');
const { STAFF_DESIGNATIONS } = require('../utils/staffRoles');

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
      $or: [{ name: regex }, { mobile: regex }, { email: regex }, { city: regex }, { remarks: regex }]
    });
  }
  if (queryParams.followUpDue === 'true') {
    query.nextFollowUp = { $lte: new Date() };
    query.status = { $nin: ['Delivered', 'Lost', 'Not Interested'] };
  }
  return query;
}

/** GET /admin/td/leads */
exports.getCrmLeads = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { page, limit, skip } = getPagination(req);
  const query = buildLeadQuery(req.admin, req.query);

  const [docs, total] = await Promise.all([
    Lead.find(query)
      .populate('assignedTo', 'name email role designation')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Lead.countDocuments(query)
  ]);

  res.json({
    success: true,
    stages: CRM_LEAD_STAGES,
    ...buildPaginatedResponse({ docs, total, page, limit })
  });
});

/** GET /admin/td/leads/:id */
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
      .limit(100)
  ]);

  res.json({
    success: true,
    data: {
      lead,
      history,
      followUps,
      stages: CRM_LEAD_STAGES
    }
  });
});

/** PATCH /admin/td/leads/:id/stage */
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
    return res.json({ success: true, data: lead, message: 'Stage unchanged' });
  }

  lead.status = stage;
  await lead.save();

  await LeadStageHistory.create({
    leadId: lead._id,
    fromStage: prevStage,
    toStage: stage,
    changedBy: req.admin._id,
    reason: reason || `Stage updated to ${stage}`
  });

  await lead.populate('assignedTo', 'name email role designation');
  res.json({ success: true, data: lead, message: `Lead moved to ${stage}` });
});

/** PATCH /admin/td/leads/:id/remarks */
exports.updateLeadRemarks = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { remarks } = req.body;
  if (remarks == null) throw new ApiError(400, 'Remarks are required');

  const lead = await Lead.findById(req.params.id);
  assertLeadReadable(lead, req.admin);

  lead.remarks = String(remarks).trim();
  await lead.save();
  await lead.populate('assignedTo', 'name email role designation');

  res.json({ success: true, data: lead, message: 'Remarks saved' });
});

/** POST /admin/td/leads/:id/follow-ups */
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
    status: isCompleted ? 'completed' : 'pending'
  });

  if (scheduled && !isCompleted) {
    lead.nextFollowUp = scheduled;
    await lead.save();
  }

  await followUp.populate('createdBy', 'name email');
  res.status(201).json({ success: true, data: followUp, message: 'Follow-up logged' });
});

/** PATCH /admin/td/leads/:id/follow-ups/:followUpId */
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

  res.json({ success: true, data: followUp, message: 'Follow-up updated' });
});

/** GET /admin/td/leads/meta/executives — same list as User Master → assignable staff */
exports.listCrmExecutives = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const data = await fetchAssignableStaff();
  res.json({ success: true, data });
});

/** PATCH /admin/td/leads/:id/assign */
exports.assignLeadExecutive = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  assertCanAssignLeads(req.admin);

  const { executiveId } = req.body;
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  let assignee = null;
  if (executiveId) {
    assignee = await Admin.findOne({
      _id: executiveId,
      active: true,
      $or: [
        { designation: { $in: STAFF_DESIGNATIONS } },
        { role: { $in: ['executive', 'manager'] }, designation: { $exists: false } }
      ]
    }).select('name email role designation');
    if (!assignee) throw new ApiError(404, 'Staff user not found in User Master or inactive');
  }

  const prevAssignee = lead.assignedTo
    ? await Admin.findById(lead.assignedTo).select('name')
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
    reason: `Assignment: ${prevLabel} → ${assignLabel}`
  });

  await updated.populate('assignedTo', 'name email role designation');
  res.json({
    success: true,
    data: updated,
    message: executiveId ? `Lead assigned to ${assignLabel}` : 'Lead unassigned'
  });
});

/** GET /admin/td/leads/meta/stages */
exports.getCrmStages = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  res.json({ success: true, data: CRM_LEAD_STAGES });
});

module.exports.buildLeadQuery = buildLeadQuery;
