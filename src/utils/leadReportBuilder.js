const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadStageHistory = require('../models/LeadStageHistory');
const TDFeedback = require('../models/TDFeedback');
const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDStaff = require('../models/TDStaff');
const { STAFF_DESIGNATIONS } = require('../models/TDStaff');
const { CRM_LEAD_STAGES, normalizeStageLabel } = require('../constants/leadStages');
const { getActiveStageLabels } = require('./leadStageService');
const { assignedToStaffFilter } = require('./leadAssignment');
const { isWalkInSource, isDigitalSource, safePct, startOfDay, startOfMonth, WALK_IN_SOURCES } = require('./crmConversion');

const CONVERTED_STATUSES = ['Interested', 'Negotiation', 'Booking', 'Delivered', 'Booked'];
const TERMINAL_STATUSES = ['Delivered', 'Lost', 'Not Interested'];

const LEAD_AGE_BUCKET_ORDER = ['0-3 Days', '4-7 Days', '8-15 Days', '15+ Days'];

function leadAgeInDays(createdAt) {
  if (!createdAt) return 0;
  const start = new Date(createdAt);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return 0;
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now - start) / (24 * 60 * 60 * 1000)));
}

function leadAgeBucket(ageDays) {
  if (ageDays <= 3) return '0-3 Days';
  if (ageDays <= 7) return '4-7 Days';
  if (ageDays <= 15) return '8-15 Days';
  return '15+ Days';
}

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

async function buildLeadAdminReport({ from, to, executiveId, status, source, model, buyerType, channel, designation } = {}) {
  const leadDateFilter = buildLeadDateFilter(from, to);
  const leadQuery = { ...leadDateFilter };
  if (executiveId) {
    Object.assign(leadQuery, assignedToStaffFilter(executiveId));
  }
  const stageFilter = status ? String(status).trim() : '';
  if (stageFilter && stageFilter.toLowerCase() !== 'all') {
    leadQuery.status = stageFilter;
  }
  const sourceFilter = source ? String(source).trim() : '';
  if (sourceFilter && sourceFilter.toLowerCase() !== 'all') {
    leadQuery.source = sourceFilter;
  }
  const modelFilter = model ? String(model).trim() : '';
  if (modelFilter && modelFilter.toLowerCase() !== 'all') {
    leadQuery.model = modelFilter;
  }
  const buyerFilter = buyerType ? String(buyerType).trim() : '';
  if (buyerFilter && buyerFilter.toLowerCase() !== 'all') {
    leadQuery.buyerType = buyerFilter;
  }
  const channelFilter = String(channel || '').trim().toLowerCase();
  if (!sourceFilter || sourceFilter.toLowerCase() === 'all') {
    if (channelFilter === 'walk-in' || channelFilter === 'walkin') {
      leadQuery.source = { $in: [...WALK_IN_SOURCES] };
    } else if (channelFilter === 'digital') {
      leadQuery.source = { $nin: [...WALK_IN_SOURCES] };
    }
  }
  const designationFilter = String(designation || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (designationFilter && designationFilter !== 'all' && !executiveId) {
    const teamStaff = await TDStaff.find({
      designation: designationFilter,
      active: { $ne: false },
    })
      .select('_id')
      .lean();
    leadQuery.assignedTo = { $in: teamStaff.map((s) => s._id) };
  }

  const now = new Date();

  const [
    totalLeadCount,
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
    Lead.countDocuments(leadQuery),
    Lead.find(leadQuery)
      .populate('assignedTo', 'name email role designation')
      .sort({ updatedAt: -1 })
      .limit(10000)
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
    TDStaff.find({
      designation: { $in: STAFF_DESIGNATIONS },
      active: true,
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

  // Test-drive enrichment for the management report: booked/done status,
  // customer photo, completion GPS location.
  const leadMobiles = [...new Set(leads.map((l) => l.mobile).filter(Boolean))];
  const linkedBookingIds = leads.map((l) => l.tdBookingId).filter(Boolean);
  const tdBookings = await TDBooking.find({
    $or: [
      ...(linkedBookingIds.length ? [{ _id: { $in: linkedBookingIds } }] : []),
      { leadId: { $in: leadIds } },
      ...(leadMobiles.length ? [{ customerMobile: { $in: leadMobiles } }] : []),
    ],
  })
    .select('bookingId bookingStatus slotDate slotTime customerMobile leadId approvalStatus isRepeatDrive')
    .lean();

  const completedTdLogs = await TDLog.find({
    bookingId: { $in: tdBookings.map((b) => b._id) },
    status: 'COMPLETED',
  })
    .select('bookingId customerPhotoUrl endLocation endTime totalKM')
    .sort({ endTime: 1 })
    .lean();

  const logByBooking = new Map(completedTdLogs.map((l) => [String(l.bookingId), l]));
  const bookingsByMobile = new Map();
  const bookingsByLead = new Map();
  for (const b of tdBookings) {
    if (b.customerMobile) {
      if (!bookingsByMobile.has(b.customerMobile)) bookingsByMobile.set(b.customerMobile, []);
      bookingsByMobile.get(b.customerMobile).push(b);
    }
    if (b.leadId) {
      const key = String(b.leadId);
      if (!bookingsByLead.has(key)) bookingsByLead.set(key, []);
      bookingsByLead.get(key).push(b);
    }
  }
  const bookingById = new Map(tdBookings.map((b) => [String(b._id), b]));

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

  const leadByMobile = new Map(leads.map((l) => [l.mobile, l]));

  const totalLeads = totalLeadCount;
  const convertedCount = leadsByStatus.reduce(
    (sum, row) => sum + (isConverted(row._id) ? row.count : 0),
    0,
  );
  const activeLeads = leadsByStatus.reduce(
    (sum, row) => sum + (TERMINAL_STATUSES.includes(normalizeStageLabel(row._id)) ? 0 : row.count),
    0,
  );

  const followUpsPending = followUps.filter((f) => f.status === 'pending').length;
  const followUpsCompleted = followUps.filter((f) => f.status === 'completed').length;
  const followUpsOverdue = followUps.filter(
    (f) => f.status === 'pending' && f.scheduledAt && new Date(f.scheduledAt) < now
  ).length;

  const pipeline = {};
  const stageLabels = await getActiveStageLabels();
  for (const stage of stageLabels) pipeline[stage] = 0;
  for (const row of leadsByStatus) {
    const key = normalizeStageLabel(row._id || 'Enquiry');
    pipeline[key] = (pipeline[key] || 0) + row.count;
  }

  const bySource = Object.fromEntries(leadsBySource.map((r) => [r._id || 'Unknown', r.count]));
  const byModel = Object.fromEntries(leadsByModel.map((r) => [r._id || 'Unknown', r.count]));

  const sourceConversionMap = new Map();
  for (const lead of leads) {
    const source = lead.source || 'Unknown';
    if (!sourceConversionMap.has(source)) {
      sourceConversionMap.set(source, { source, totalLeads: 0, convertedCount: 0, conversionRate: 0 });
    }
    const row = sourceConversionMap.get(source);
    row.totalLeads += 1;
    if (isConverted(lead.status)) row.convertedCount += 1;
  }
  const bySourceConversion = [...sourceConversionMap.values()]
    .map((row) => ({
      ...row,
      conversionRate: row.totalLeads > 0 ? Math.round((row.convertedCount / row.totalLeads) * 100) : 0,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate || b.totalLeads - a.totalLeads);

  const execSourceMap = new Map();
  for (const lead of leads) {
    const execId = lead.assignedTo?._id || lead.assignedTo;
    if (!execId) continue;
    const execKey = String(execId);
    const execName = lead.assignedTo?.name || 'Unknown';
    if (!execSourceMap.has(execKey)) {
      execSourceMap.set(execKey, {
        executiveId: execKey,
        name: execName,
        sources: new Map(),
      });
    }
    const execRow = execSourceMap.get(execKey);
    const source = lead.source || 'Unknown';
    if (!execRow.sources.has(source)) {
      execRow.sources.set(source, { source, totalLeads: 0, convertedCount: 0, conversionRate: 0 });
    }
    const srcRow = execRow.sources.get(source);
    srcRow.totalLeads += 1;
    if (isConverted(lead.status)) srcRow.convertedCount += 1;
  }
  const sourceConversionByExecutive = [...execSourceMap.values()]
    .map((execRow) => ({
      executiveId: execRow.executiveId,
      name: execRow.name,
      bySource: [...execRow.sources.values()]
        .map((s) => ({
          ...s,
          conversionRate: s.totalLeads > 0 ? Math.round((s.convertedCount / s.totalLeads) * 100) : 0,
        }))
        .sort((a, b) => b.conversionRate - a.conversionRate || b.totalLeads - a.totalLeads),
      totalLeads: [...execRow.sources.values()].reduce((sum, s) => sum + s.totalLeads, 0),
      convertedCount: [...execRow.sources.values()].reduce((sum, s) => sum + s.convertedCount, 0),
    }))
    .map((execRow) => ({
      ...execRow,
      conversionRate:
        execRow.totalLeads > 0 ? Math.round((execRow.convertedCount / execRow.totalLeads) * 100) : 0,
    }))
    .sort((a, b) => b.totalLeads - a.totalLeads);

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
        behaviourRatings: [],
        frtMinutesSum: 0,
        frtCount: 0,
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
    if (lead.firstRespondedAt && lead.createdAt) {
      row.frtMinutesSum += (new Date(lead.firstRespondedAt) - new Date(lead.createdAt)) / 60000;
      row.frtCount += 1;
    }
  }

  for (const h of stageHistory) {
    const execId = h.changedBy?._id || h.changedBy;
    if (!execId) continue;
    // Assignments and detail edits log history with fromStage === toStage; don't count those as stage changes.
    if (h.fromStage === h.toStage) continue;
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
      avgFirstResponseMinutes: e.frtCount ? Math.round(e.frtMinutesSum / e.frtCount) : null,
      avgExecutiveBehaviour:
        e.behaviourRatings.length > 0
          ? Math.round((e.behaviourRatings.reduce((a, b) => a + b, 0) / e.behaviourRatings.length) * 10) / 10
          : null,
      behaviourRatings: undefined,
      frtMinutesSum: undefined,
      frtCount: undefined,
    }))
    .sort((a, b) => b.leadsAssigned - a.leadsAssigned);

  const leadStatusById = new Map(leads.map((l) => [String(l._id), l]));

  const feedbackRows = feedbacks.map((fb) => {
    const customer = fb.customerId;
    const lead = customer?.mobile ? leadByMobile.get(customer.mobile) : null;
    const leadId = lead ? String(lead._id) : null;
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
      type: h.reason?.startsWith('Assignment:')
        ? 'assignment'
        : h.reason?.startsWith('Details updated')
          ? 'edit'
          : 'stage_change',
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
    const leadFeedback = feedbackRows.find((f) => f.leadId === String(l._id));
    const ageDays = leadAgeInDays(l.createdAt);
    const ageBucket = leadAgeBucket(ageDays);

    // Test drive status for this lead's customer.
    const leadBookings = [
      ...(bookingsByLead.get(String(l._id)) || []),
      ...(bookingsByMobile.get(l.mobile) || []),
      ...(l.tdBookingId && bookingById.has(String(l.tdBookingId))
        ? [bookingById.get(String(l.tdBookingId))]
        : []),
    ];
    const uniqueBookings = [...new Map(leadBookings.map((b) => [String(b._id), b])).values()];
    const completedBooking = uniqueBookings.find((b) => b.bookingStatus === 'COMPLETED');
    const awaitingApproval = uniqueBookings.some(
      (b) => b.approvalStatus === 'PENDING' && !['CANCELLED', 'COMPLETED'].includes(b.bookingStatus),
    );
    const activeBooking = uniqueBookings.find((b) =>
      ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'].includes(b.bookingStatus),
    );
    const testDriveStatus = completedBooking
      ? 'Done'
      : awaitingApproval
        ? 'Awaiting Approval'
        : activeBooking
          ? 'Booked'
          : 'Not Booked';

    const completionLog = completedBooking ? logByBooking.get(String(completedBooking._id)) : null;

    // Delay / pending status for management attention.
    const stage = normalizeStageLabel(l.status);
    const isTerminal = TERMINAL_STATUSES.includes(stage);
    const lastActivity = l.lastActivityAt || l.updatedAt || l.createdAt;
    const daysSinceActivity = lastActivity
      ? Math.floor((now - new Date(lastActivity)) / (24 * 60 * 60 * 1000))
      : ageDays;
    const followUpOverdue = Boolean(l.nextFollowUp && new Date(l.nextFollowUp) < now && !isTerminal);
    const delayStatus = isTerminal
      ? 'Closed'
      : followUpOverdue
        ? 'Overdue'
        : daysSinceActivity > 7
          ? 'Delayed'
          : 'On Track';

    // Suggested next action for management.
    let actionRequired = null;
    if (!isTerminal) {
      if (!l.assignedTo) actionRequired = 'Assign executive';
      else if (awaitingApproval) actionRequired = 'Approve repeat test drive request';
      else if (followUpOverdue) actionRequired = 'Chase overdue follow-up';
      else if (stage === 'Test Drive Completed' && leadFeedback?.overallRating == null)
        actionRequired = 'Collect test drive feedback';
      else if (daysSinceActivity > 7) actionRequired = `No activity for ${daysSinceActivity} days — review`;
      else if (ageDays > 15 && !isConverted(l.status)) actionRequired = 'Stale lead — review or close';
    }

    return {
      leadId: String(l._id),
      name: l.name,
      mobile: l.mobile,
      model: l.model,
      status: stage,
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
      ageDays,
      ageBucket,
      // Test drive & completion evidence
      testDriveStatus,
      testDriveBooked: uniqueBookings.length > 0,
      testDriveDone: Boolean(completedBooking),
      testDriveBookingId: completedBooking?.bookingId || activeBooking?.bookingId || null,
      customerPhotoUrl: completionLog?.customerPhotoUrl || null,
      latitude: completionLog?.endLocation?.lat ?? null,
      longitude: completionLog?.endLocation?.lng ?? null,
      testDriveKm: completionLog?.totalKM ?? null,
      // Management attention
      delayStatus,
      actionRequired: actionRequired || '—',
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    };
  });

  const ageingCounts = Object.fromEntries(LEAD_AGE_BUCKET_ORDER.map((b) => [b, 0]));
  for (const row of leadDetailRows) {
    ageingCounts[row.ageBucket] = (ageingCounts[row.ageBucket] || 0) + 1;
  }
  const leadAgeing = LEAD_AGE_BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: ageingCounts[bucket] || 0,
  }));

  const avgFeedback =
    feedbacks.length > 0
      ? Math.round((feedbacks.reduce((s, f) => s + (f.overallRating || 0), 0) / feedbacks.length) * 10) / 10
      : 0;

  const testDrivesBookedCount = leadDetailRows.filter((r) => r.testDriveBooked).length;
  const testDrivesDoneCount = leadDetailRows.filter((r) => r.testDriveDone).length;
  const pendingApprovalCount = leadDetailRows.filter((r) => r.testDriveStatus === 'Awaiting Approval').length;
  const delayedCount = leadDetailRows.filter((r) => ['Overdue', 'Delayed'].includes(r.delayStatus)).length;
  const actionRequiredCount = leadDetailRows.filter((r) => r.actionRequired && r.actionRequired !== '—').length;

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
      avgFeedbackRating: avgFeedback,
      testDrivesBooked: testDrivesBookedCount,
      testDrivesDone: testDrivesDoneCount,
      repeatApprovalsPending: pendingApprovalCount,
      delayedLeads: delayedCount,
      actionRequired: actionRequiredCount
    },
    pipeline,
    bySource,
    byModel,
    bySourceConversion,
    sourceConversionByExecutive,
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
    leadDetailRows: leadDetailRows.slice(0, 2000),
    leadAgeing,
    stages: stageLabels,
    kpis: buildKpiSummary(leads, followUps, tdBookings, now),
    conversions: buildConversionSummary(leads, tdBookings),
    funnelReport: buildFunnelReport(pipeline, stageLabels, stageHistory, leads),
    sourcePerformance: buildSourcePerformance(leads, tdBookings),
    modelPerformance: buildModelPerformance(leads, tdBookings),
    followUpPerformance: buildFollowUpPerformance(followUps, now),
    tdPerformance: buildTdPerformance(tdBookings),
    inactivityAgeing: buildInactivityAgeing(leads, now),
  };
}

function buildKpiSummary(leads, followUps, tdBookings, now) {
  const todayStart = startOfDay(now);
  const mtdStart = startOfMonth(now);
  const inRange = (d, from) => d && new Date(d) >= from;
  const walkIn = (l) => isWalkInSource(l.source);
  const tdBooked = tdBookings.filter((b) => b.bookingStatus !== 'CANCELLED');
  const tdDone = tdBookings.filter((b) => b.bookingStatus === 'COMPLETED');
  const countToday = (arr, field) => arr.filter((x) => inRange(x[field], todayStart) && new Date(x[field]) <= now).length;
  return {
    today: {
      totalLeads: leads.filter((l) => inRange(l.createdAt, todayStart)).length,
      walkIn: leads.filter((l) => walkIn(l) && inRange(l.createdAt, todayStart)).length,
      digital: leads.filter((l) => !walkIn(l) && inRange(l.createdAt, todayStart)).length,
      followUpDue: followUps.filter((f) => f.status === 'pending' && f.scheduledAt && new Date(f.scheduledAt) >= todayStart && new Date(f.scheduledAt) <= now).length,
      overdueFollowUps: followUps.filter((f) => f.status === 'pending' && f.scheduledAt && new Date(f.scheduledAt) < todayStart).length,
      tdBooked: tdBooked.filter((b) => inRange(b.slotDate || b.createdAt, todayStart)).length,
      tdCompleted: tdDone.filter((b) => inRange(b.updatedAt || b.slotDate, todayStart)).length,
      negotiation: leads.filter((l) => l.status === 'Negotiation').length,
      bookings: leads.filter((l) => l.status === 'Booking' && inRange(l.updatedAt, todayStart)).length,
      deliveries: leads.filter((l) => l.status === 'Delivered' && inRange(l.updatedAt, todayStart)).length,
      lost: leads.filter((l) => l.status === 'Lost' && inRange(l.updatedAt, todayStart)).length,
    },
    mtd: {
      totalLeads: leads.filter((l) => inRange(l.createdAt, mtdStart)).length,
      walkIn: leads.filter((l) => walkIn(l) && inRange(l.createdAt, mtdStart)).length,
      digital: leads.filter((l) => !walkIn(l) && inRange(l.createdAt, mtdStart)).length,
      followUpDue: followUps.filter((f) => f.status === 'pending').length,
      overdueFollowUps: followUps.filter((f) => f.status === 'pending' && f.scheduledAt && new Date(f.scheduledAt) < now).length,
      tdBooked: tdBooked.length,
      tdCompleted: tdDone.length,
      negotiation: leads.filter((l) => l.status === 'Negotiation').length,
      bookings: leads.filter((l) => ['Booking', 'Delivered'].includes(l.status)).length,
      deliveries: leads.filter((l) => l.status === 'Delivered').length,
      lost: leads.filter((l) => l.status === 'Lost').length,
    },
  };
}

function buildConversionSummary(leads, tdBookings) {
  const eligible = leads.filter((l) => isWalkInSource(l.source) || isDigitalSource(l.source)).length;
  const tdCompleted = tdBookings.filter((b) => b.bookingStatus === 'COMPLETED').length;
  const tdBooked = tdBookings.filter((b) => b.bookingStatus !== 'CANCELLED').length;
  const bookings = leads.filter((l) => ['Booking', 'Delivered'].includes(normalizeStageLabel(l.status))).length;
  const deliveries = leads.filter((l) => normalizeStageLabel(l.status) === 'Delivered').length;
  return {
    eligibleLeads: eligible,
    tdBooked,
    tdCompleted,
    bookings,
    deliveries,
    leadToTdPct: safePct(tdCompleted || tdBooked, eligible),
    tdToBookingPct: safePct(bookings, tdCompleted),
    leadToBookingPct: safePct(bookings, eligible),
    bookingToDeliveryPct: safePct(deliveries, bookings),
  };
}

function buildFunnelReport(pipeline, stageLabels, stageHistory, leads) {
  const total = leads.length || 1;
  const byLead = new Map();
  for (const h of stageHistory || []) {
    const id = String(h.leadId?._id || h.leadId || '');
    if (!id) continue;
    if (!byLead.has(id)) byLead.set(id, []);
    byLead.get(id).push(h);
  }
  const avgMs = {};
  for (const rows of byLead.values()) {
    rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    for (let i = 0; i < rows.length; i += 1) {
      const from = rows[i].fromStage || rows[i].toStage;
      const start = rows[i].createdAt;
      const end = rows[i + 1]?.createdAt;
      if (!from || !start || !end) continue;
      const ms = new Date(end) - new Date(start);
      if (!Number.isFinite(ms) || ms < 0) continue;
      if (!avgMs[from]) avgMs[from] = [];
      avgMs[from].push(ms);
    }
  }
  return stageLabels.map((stage, idx) => {
    const count = pipeline[stage] || 0;
    const nextCount = idx < stageLabels.length - 1 ? pipeline[stageLabels[idx + 1]] || 0 : count;
    const samples = avgMs[stage] || [];
    const avgHours = samples.length
      ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length / 36e5) * 10) / 10
      : 0;
    return {
      stage,
      count,
      conversionPct: safePct(nextCount, count || total),
      dropPct: safePct(Math.max(0, count - nextCount), count || total),
      avgHoursInStage: avgHours,
      avgDaysInStage: Math.round((avgHours / 24) * 10) / 10,
    };
  });
}

function buildSourcePerformance(leads, tdBookings) {
  const tdByMobile = new Set(
    tdBookings.filter((b) => b.bookingStatus === 'COMPLETED').map((b) => b.customerId?.mobile || b.mobile),
  );
  const map = new Map();
  for (const l of leads) {
    const source = l.source || 'Unknown';
    if (!map.has(source)) {
      map.set(source, { source, leads: 0, interested: 0, td: 0, booking: 0, delivery: 0 });
    }
    const row = map.get(source);
    row.leads += 1;
    const st = normalizeStageLabel(l.status);
    if (['Interested', 'Test Drive Booked', 'Test Drive Completed', 'Negotiation', 'Booking', 'Delivered'].includes(st)) {
      row.interested += 1;
    }
    if (tdByMobile.has(l.mobile) || ['Test Drive Booked', 'Test Drive Completed'].includes(st)) row.td += 1;
    if (['Booking', 'Delivered'].includes(st)) row.booking += 1;
    if (st === 'Delivered') row.delivery += 1;
  }
  return [...map.values()].map((r) => ({
    ...r,
    leadToBookingPct: safePct(r.booking, r.leads),
  }));
}

function buildModelPerformance(leads, tdBookings) {
  const tdByModel = {};
  for (const b of tdBookings) {
    const m = b.preferredModel || b.model || 'Unknown';
    tdByModel[m] = (tdByModel[m] || 0) + 1;
  }
  const map = new Map();
  for (const l of leads) {
    const model = l.model || 'Unknown';
    if (!map.has(model)) {
      map.set(model, { model, enquiry: 0, interested: 0, td: 0, booking: 0, delivery: 0, lost: 0 });
    }
    const row = map.get(model);
    row.enquiry += 1;
    const st = normalizeStageLabel(l.status);
    if (st === 'Interested' || st === 'Negotiation') row.interested += 1;
    if (['Booking', 'Delivered'].includes(st)) row.booking += 1;
    if (st === 'Delivered') row.delivery += 1;
    if (st === 'Lost') row.lost += 1;
  }
  return [...map.values()].map((r) => ({
    ...r,
    td: tdByModel[r.model] || r.td,
  }));
}

function buildTdPerformance(tdBookings) {
  const map = new Map();
  for (const b of tdBookings || []) {
    const exec = b.assignedExecutive;
    const key = String(exec?._id || exec || 'unassigned');
    if (!map.has(key)) {
      map.set(key, {
        employeeId: key,
        employee: exec?.name || 'Unassigned',
        booked: 0,
        completed: 0,
        cancelled: 0,
        rescheduled: 0,
      });
    }
    const row = map.get(key);
    if (b.bookingStatus === 'CANCELLED') row.cancelled += 1;
    else row.booked += 1;
    if (b.bookingStatus === 'COMPLETED') row.completed += 1;
    if (b.rescheduleCount) row.rescheduled += Number(b.rescheduleCount) || 0;
  }
  return [...map.values()].map((r) => ({
    ...r,
    completionPct: safePct(r.completed, r.booked),
  }));
}

function buildFollowUpPerformance(followUps, now) {
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const map = new Map();
  for (const f of followUps) {
    const key = String(f.createdBy?._id || f.createdBy || 'unknown');
    if (!map.has(key)) {
      map.set(key, {
        employeeId: key,
        employee: f.createdBy?.name || '—',
        assigned: 0,
        dueToday: 0,
        completed: 0,
        overdue: 0,
        rescheduled: 0,
      });
    }
    const row = map.get(key);
    row.assigned += 1;
    if (f.status === 'completed') row.completed += 1;
    if (f.status === 'pending' && f.scheduledAt) {
      const d = new Date(f.scheduledAt);
      if (d >= todayStart && d <= todayEnd) row.dueToday += 1;
      if (d < now) row.overdue += 1;
    }
  }
  return [...map.values()].map((r) => ({
    ...r,
    conversionPct: safePct(r.completed, r.assigned),
  }));
}

function buildInactivityAgeing(leads, now) {
  const buckets = { '1 Day': 0, '3 Days': 0, '7+ Days': 0 };
  for (const l of leads) {
    if (['Delivered', 'Lost', 'Not Interested'].includes(normalizeStageLabel(l.status))) continue;
    const last = l.lastActivityAt || l.updatedAt;
    if (!last) continue;
    const days = Math.floor((now - new Date(last)) / 86400000);
    if (days >= 7) buckets['7+ Days'] += 1;
    else if (days >= 3) buckets['3 Days'] += 1;
    else if (days >= 1) buckets['1 Day'] += 1;
  }
  const responded = leads.filter((l) => l.firstRespondedAt && l.createdAt);
  const avgFirstResponseMinutes = responded.length
    ? Math.round(
        responded.reduce((s, l) => s + (new Date(l.firstRespondedAt) - new Date(l.createdAt)) / 60000, 0) /
          responded.length,
      )
    : 0;
  return { buckets, avgFirstResponseMinutes, firstResponseSample: responded.length };
}

module.exports = { buildLeadAdminReport, CONVERTED_STATUSES };
