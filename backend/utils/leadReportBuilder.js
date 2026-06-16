const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadStageHistory = require('../models/LeadStageHistory');
const TDFeedback = require('../models/TDFeedback');
const TDBooking = require('../models/TDBooking');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const { CRM_LEAD_STAGES, normalizeStageLabel } = require('../constants/leadStages');
const { STAFF_DESIGNATIONS } = require('./staffRoles');

const CONVERTED_STATUSES = ['Interested', 'Negotiation', 'Booking', 'Delivered', 'Booked'];
const TERMINAL_STATUSES = ['Delivered', 'Lost', 'Not Interested'];

function buildLeadDateFilter(from, to, field = 'createdAt') {
  const filter = {};
  if (from || to) {
    filter[field] = {};
    if (from) filter[field].$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter[field].$lte = end;
    }
  }
  return filter;
}

function isConverted(status) {
  return CONVERTED_STATUSES.includes(normalizeStageLabel(status));
}

async function buildLeadAdminReport({ from, to, executiveId } = {}) {
  const leadDateFilter = buildLeadDateFilter(from, to);
  const leadQuery = { ...leadDateFilter };
  if (executiveId) {
    leadQuery.assignedTo = new mongoose.Types.ObjectId(executiveId);
  }

  const now = new Date();

  const [
    leads,
    leadsByStatus,
    leadsBySource,
    leadsByModel,
    unassignedCount,
    followUps,
    stageHistory,
    staffList,
    feedbacks,
    bookingsWithExec
  ] = await Promise.all([
    Lead.find(leadQuery)
      .populate('assignedTo', 'name email role designation')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean(),
    Lead.aggregate([
      { $match: leadQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Lead.aggregate([
      { $match: leadQuery },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]),
    Lead.aggregate([
      { $match: leadQuery },
      { $group: { _id: '$model', count: { $sum: 1 } } }
    ]),
    Lead.countDocuments({
      ...leadQuery,
      $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }]
    }),
    LeadFollowUp.find(
      executiveId
        ? { createdBy: executiveId, ...(Object.keys(buildLeadDateFilter(from, to)).length ? buildLeadDateFilter(from, to) : {}) }
        : Object.keys(buildLeadDateFilter(from, to)).length
          ? buildLeadDateFilter(from, to)
          : {}
    )
      .populate('createdBy', 'name email')
      .populate({ path: 'leadId', select: 'name mobile model status assignedTo', populate: { path: 'assignedTo', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean(),
    LeadStageHistory.find(
      executiveId
        ? { changedBy: executiveId, ...(Object.keys(buildLeadDateFilter(from, to)).length ? buildLeadDateFilter(from, to) : {}) }
        : Object.keys(buildLeadDateFilter(from, to)).length
          ? buildLeadDateFilter(from, to)
          : {}
    )
      .populate('changedBy', 'name email')
      .populate('leadId', 'name mobile model status')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean(),
    Admin.find({
      $or: [
        { designation: { $in: STAFF_DESIGNATIONS } },
        { role: { $in: ['executive', 'manager'] } }
      ],
      active: true
    })
      .select('name email role designation')
      .lean(),
    TDFeedback.find(buildLeadDateFilter(from, to))
      .populate('customerId', 'name mobile leadId')
      .populate({ path: 'bookingId', select: 'bookingId slotDate assignedExecutive preferredModel', populate: { path: 'assignedExecutive', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    TDBooking.find({
      assignedExecutive: { $exists: true, $ne: null },
      bookingStatus: 'COMPLETED',
      ...buildLeadDateFilter(from, to, 'slotDate')
    })
      .select('assignedExecutive customerId')
      .lean()
  ]);

  const leadIds = leads.map((l) => l._id);
  const followUpCounts = await LeadFollowUp.aggregate([
    { $match: { leadId: { $in: leadIds } } },
    {
      $group: {
        _id: '$leadId',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        lastAt: { $max: '$createdAt' }
      }
    }
  ]);
  const followUpByLead = new Map(followUpCounts.map((r) => [String(r._id), r]));

  const customerLeadMap = new Map();
  const customers = await Customer.find({ leadId: { $in: leadIds } }).select('leadId name mobile').lean();
  for (const c of customers) {
    if (c.leadId) customerLeadMap.set(String(c.leadId), c);
  }

  const totalLeads = leads.length;
  const convertedCount = leads.filter((l) => isConverted(l.status)).length;
  const activeLeads = leads.filter((l) => !TERMINAL_STATUSES.includes(normalizeStageLabel(l.status))).length;

  const followUpsPending = followUps.filter((f) => f.status === 'pending').length;
  const followUpsCompleted = followUps.filter((f) => f.status === 'completed').length;
  const followUpsOverdue = followUps.filter(
    (f) => f.status === 'pending' && f.scheduledAt && new Date(f.scheduledAt) < now
  ).length;

  const pipeline = {};
  for (const stage of CRM_LEAD_STAGES) pipeline[stage] = 0;
  for (const row of leadsByStatus) {
    const key = normalizeStageLabel(row._id || 'Enquiry');
    pipeline[key] = (pipeline[key] || 0) + row.count;
  }

  const bySource = Object.fromEntries(leadsBySource.map((r) => [r._id || 'Unknown', r.count]));
  const byModel = Object.fromEntries(leadsByModel.map((r) => [r._id || 'Unknown', r.count]));

  const execMap = new Map();
  const ensureExec = (id, name = 'Unknown') => {
    const key = id ? String(id) : 'unassigned';
    if (!execMap.has(key)) {
      execMap.set(key, {
        executiveId: id || null,
        name,
        leadsAssigned: 0,
        leadsConverted: 0,
        stageChanges: 0,
        followUpsLogged: 0,
        followUpsCompleted: 0,
        followUpsPending: 0,
        followUpsOverdue: 0,
        testDrivesCompleted: 0,
        feedbackCount: 0,
        avgExecutiveBehaviour: null,
        behaviourRatings: []
      });
    }
    return execMap.get(key);
  };

  for (const s of staffList) ensureExec(s._id, s.name);

  for (const lead of leads) {
    const execId = lead.assignedTo?._id || lead.assignedTo;
    const row = ensureExec(execId, lead.assignedTo?.name || 'Unassigned');
    row.leadsAssigned += 1;
    if (isConverted(lead.status)) row.leadsConverted += 1;
  }

  for (const h of stageHistory) {
    const execId = h.changedBy?._id || h.changedBy;
    if (!execId) continue;
    const row = ensureExec(execId, h.changedBy?.name);
    row.stageChanges += 1;
  }

  for (const f of followUps) {
    const execId = f.createdBy?._id || f.createdBy;
    if (!execId) continue;
    const row = ensureExec(execId, f.createdBy?.name);
    row.followUpsLogged += 1;
    if (f.status === 'completed') row.followUpsCompleted += 1;
    if (f.status === 'pending') {
      row.followUpsPending += 1;
      if (f.scheduledAt && new Date(f.scheduledAt) < now) row.followUpsOverdue += 1;
    }
  }

  for (const b of bookingsWithExec) {
    const row = ensureExec(b.assignedExecutive, undefined);
    row.testDrivesCompleted += 1;
  }

  for (const fb of feedbacks) {
    const exec = fb.bookingId?.assignedExecutive;
    const execId = exec?._id || exec;
    if (!execId) continue;
    const row = ensureExec(execId, exec?.name);
    row.feedbackCount += 1;
    if (fb.executiveBehaviour != null) row.behaviourRatings.push(fb.executiveBehaviour);
  }

  const executivePerformance = [...execMap.values()]
    .filter((e) => e.executiveId && (e.leadsAssigned > 0 || e.followUpsLogged > 0 || e.stageChanges > 0 || e.feedbackCount > 0))
    .map((e) => ({
      ...e,
      conversionRate: e.leadsAssigned > 0 ? Math.round((e.leadsConverted / e.leadsAssigned) * 100) : 0,
      avgExecutiveBehaviour:
        e.behaviourRatings.length > 0
          ? Math.round((e.behaviourRatings.reduce((a, b) => a + b, 0) / e.behaviourRatings.length) * 10) / 10
          : null,
      behaviourRatings: undefined
    }))
    .sort((a, b) => b.leadsAssigned - a.leadsAssigned);

  const leadStatusById = new Map(leads.map((l) => [String(l._id), l]));

  const feedbackRows = feedbacks.map((fb) => {
    const customer = fb.customerId;
    const leadId = customer?.leadId ? String(customer.leadId) : null;
    const lead = leadId ? leadStatusById.get(leadId) : null;
    return {
      createdAt: fb.createdAt,
      customerName: customer?.name || '—',
      mobile: customer?.mobile || '—',
      leadId,
      leadName: lead?.name || customer?.name || '—',
      leadStatus: lead?.status || null,
      executiveName: fb.bookingId?.assignedExecutive?.name || '—',
      bookingId: fb.bookingId?.bookingId || String(fb.bookingId?._id || ''),
      model: fb.bookingId?.preferredModel || lead?.model || '—',
      overallRating: fb.overallRating,
      purchaseIntention: fb.purchaseIntention,
      executiveBehaviour: fb.executiveBehaviour,
      remarks: fb.remarks || '—'
    };
  });

  const activityLog = [];

  for (const h of stageHistory) {
    if (!h.leadId) continue;
    activityLog.push({
      type: h.reason?.startsWith('Assignment:') ? 'assignment' : 'stage_change',
      at: h.createdAt,
      executiveName: h.changedBy?.name || 'System',
      executiveId: h.changedBy?._id || h.changedBy,
      leadId: String(h.leadId._id || h.leadId),
      leadName: h.leadId.name || '—',
      leadMobile: h.leadId.mobile || '—',
      detail: h.reason || `${h.fromStage || '—'} → ${h.toStage}`
    });
  }

  for (const f of followUps) {
    if (!f.leadId) continue;
    activityLog.push({
      type: 'follow_up',
      at: f.createdAt,
      executiveName: f.createdBy?.name || '—',
      executiveId: f.createdBy?._id || f.createdBy,
      leadId: String(f.leadId._id || f.leadId),
      leadName: f.leadId.name || '—',
      leadMobile: f.leadId.mobile || '—',
      detail: f.status === 'completed'
        ? `Follow-up done: ${f.note}${f.outcome ? ` · ${f.outcome}` : ''}`
        : `Follow-up: ${f.note}${f.scheduledAt ? ` · due ${new Date(f.scheduledAt).toLocaleDateString('en-IN')}` : ''}`,
      status: f.status
    });
  }

  for (const fb of feedbackRows.slice(0, 50)) {
    activityLog.push({
      type: 'feedback',
      at: fb.createdAt,
      executiveName: fb.executiveName,
      leadId: fb.leadId,
      leadName: fb.leadName,
      leadMobile: fb.mobile,
      detail: `Feedback ${fb.overallRating ?? '—'}⭐ · purchase intent ${fb.purchaseIntention ?? '—'}/5`
    });
  }

  activityLog.sort((a, b) => new Date(b.at) - new Date(a.at));

  const leadDetailRows = leads.map((l) => {
    const fu = followUpByLead.get(String(l._id));
    const customer = customerLeadMap.get(String(l._id));
    const leadFeedback = feedbackRows.find((f) => f.leadId === String(l._id));
    return {
      leadId: String(l._id),
      name: l.name,
      mobile: l.mobile,
      model: l.model,
      status: normalizeStageLabel(l.status),
      source: l.source || '—',
      interest: l.interest || '—',
      assignedTo: l.assignedTo?.name || 'Unassigned',
      assignedToId: l.assignedTo?._id ? String(l.assignedTo._id) : null,
      followUpCount: fu?.total || 0,
      followUpsPending: fu?.pending || 0,
      lastFollowUp: fu?.lastAt || null,
      nextFollowUp: l.nextFollowUp || null,
      remarks: l.remarks || '—',
      feedbackRating: leadFeedback?.overallRating ?? null,
      purchaseIntention: leadFeedback?.purchaseIntention ?? null,
      converted: isConverted(l.status),
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    };
  });

  const avgFeedback =
    feedbacks.length > 0
      ? Math.round((feedbacks.reduce((s, f) => s + (f.overallRating || 0), 0) / feedbacks.length) * 10) / 10
      : 0;

  return {
    overview: {
      totalLeads,
      activeLeads,
      unassigned: unassignedCount,
      convertedCount,
      conversionRate: totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0,
      followUpsPending,
      followUpsCompleted,
      followUpsOverdue,
      feedbackCount: feedbacks.length,
      avgFeedbackRating: avgFeedback
    },
    pipeline,
    bySource,
    byModel,
    executivePerformance,
    followUpSummary: {
      pending: followUpsPending,
      completed: followUpsCompleted,
      overdue: followUpsOverdue,
      cancelled: followUps.filter((f) => f.status === 'cancelled').length,
      total: followUps.length
    },
    followUpRows: followUps.map((f) => ({
      id: String(f._id),
      leadId: f.leadId?._id ? String(f.leadId._id) : null,
      leadName: f.leadId?.name || '—',
      leadMobile: f.leadId?.mobile || '—',
      leadStatus: f.leadId?.status ? normalizeStageLabel(f.leadId.status) : '—',
      executiveName: f.createdBy?.name || '—',
      note: f.note,
      scheduledAt: f.scheduledAt,
      completedAt: f.completedAt,
      outcome: f.outcome || '—',
      status: f.status,
      createdAt: f.createdAt
    })),
    activityLog: activityLog.slice(0, 150),
    feedbackRows,
    leadDetailRows,
    stages: CRM_LEAD_STAGES
  };
}

module.exports = { buildLeadAdminReport, CONVERTED_STATUSES };
