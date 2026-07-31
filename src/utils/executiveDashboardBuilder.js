require('../models/tdModels');

const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const TDFeedback = require('../models/TDFeedback');
const { buildLeadAdminReport } = require('./leadReportBuilder');
const { normalizeStageLabel } = require('../constants/leadStages');
const { toObjectId, assignedToStaffFilter, assignedToIdsFilter, assignedExecutiveIdsFilter, resolveStaffIdsForUser, resolveStaffEmailsForIds, normalizeEmail, isTeamScopedUser, isExecutiveScopedUser } = require('./leadAssignment');
const TDStaff = require('../models/TDStaff');

const CLOSED_LEAD_STATUSES = ['Lost', 'Delivered', 'Not Interested'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function yearBounds(year) {
  const y = Number(year) || new Date().getFullYear();
  return {
    year: y,
    from: `${y}-01-01`,
    to: `${y}-12-31`,
  };
}

function slotDateFilter(from, to) {
  const filter = {};
  if (from || to) {
    filter.slotDate = {};
    if (from) filter.slotDate.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.slotDate.$lte = end;
    }
  }
  return filter;
}

function createdAtFilter(from, to) {
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return filter;
}

async function buildExecutiveTdStats({ executiveId, from, to }) {
  const execId = toObjectId(executiveId);
  if (!execId) {
    return {
      totalBookings: 0, completed: 0, pending: 0, cancelled: 0, missed: 0, inProgress: 0,
      completionRate: 0, feedbackCount: 0, avgFeedbackRating: 0, avgPurchaseIntention: 0, byModel: {},
    };
  }
  const base = { assignedExecutive: execId, ...slotDateFilter(from, to) };

  const [total, completed, pending, cancelled, missed, inProgress, feedbackAgg, byModel] = await Promise.all([
    TDBooking.countDocuments(base),
    TDBooking.countDocuments({ ...base, bookingStatus: 'COMPLETED' }),
    TDBooking.countDocuments({ ...base, bookingStatus: { $in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] } }),
    TDBooking.countDocuments({ ...base, bookingStatus: 'CANCELLED' }),
    TDBooking.countDocuments({ ...base, bookingStatus: 'MISSED' }),
    TDBooking.countDocuments({ ...base, bookingStatus: 'IN_PROGRESS' }),
    TDFeedback.aggregate([
      {
        $lookup: {
          from: 'tdbookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      {
        $match: {
          'booking.assignedExecutive': execId,
          ...(Object.keys(createdAtFilter(from, to)).length ? createdAtFilter(from, to) : {}),
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgOverall: { $avg: '$overallRating' },
          avgPurchase: { $avg: '$purchaseIntention' },
        },
      },
    ]),
    TDBooking.aggregate([
      { $match: base },
      { $group: { _id: '$preferredModel', count: { $sum: 1 } } },
    ]),
  ]);

  const fb = feedbackAgg[0] || { count: 0, avgOverall: 0, avgPurchase: 0 };

  return {
    totalBookings: total,
    completed,
    pending,
    cancelled,
    missed,
    inProgress,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    feedbackCount: fb.count || 0,
    avgFeedbackRating: fb.avgOverall ? Math.round(fb.avgOverall * 10) / 10 : 0,
    avgPurchaseIntention: fb.avgPurchase ? Math.round(fb.avgPurchase * 10) / 10 : 0,
    byModel: Object.fromEntries(byModel.map((r) => [r._id || 'Unknown', r.count])),
  };
}

async function buildMonthlyBreakdown(executiveId, year) {
  const assignFilter = assignedToStaffFilter(executiveId);
  const execId = toObjectId(executiveId);
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year}-12-31T23:59:59.999Z`);

  const [leadMonths, tdMonths] = await Promise.all([
    Lead.aggregate([
      { $match: { ...assignFilter, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    ]),
    execId
      ? TDBooking.aggregate([
          { $match: { assignedExecutive: execId, slotDate: { $gte: start, $lte: end } } },
          {
            $group: {
              _id: { $month: '$slotDate' },
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] } },
            },
          },
        ])
      : [],
  ]);

  const leadMap = new Map(leadMonths.map((r) => [r._id, r.count]));
  const tdMap = new Map(tdMonths.map((r) => [r._id, r]));

  return MONTH_LABELS.map((label, idx) => {
    const month = idx + 1;
    const td = tdMap.get(month);
    return {
      month,
      label,
      leads: leadMap.get(month) || 0,
      testDrives: td?.total || 0,
      testDrivesCompleted: td?.completed || 0,
    };
  });
}

async function fetchRecentBookings(executiveId, limit = 15) {
  const execId = toObjectId(executiveId);
  if (!execId) return [];
  const docs = await TDBooking.find({ assignedExecutive: execId })
    .sort({ slotDate: -1, createdAt: -1 })
    .limit(limit)
    .populate('customerId', 'name mobile')
    .select('bookingId bookingStatus slotDate slotTime preferredModel customerName customerMobile')
    .lean();

  return docs.map((b) => ({
    bookingId: b.bookingId,
    status: b.bookingStatus,
    slotDate: b.slotDate,
    slotTime: b.slotTime,
    model: b.preferredModel || '—',
    customerName: b.customerId?.name || b.customerName || '—',
    mobile: b.customerId?.mobile || b.customerMobile || '—',
  }));
}

async function buildExecutiveDashboard({ executiveId, year } = {}) {
  if (!executiveId) throw new Error('executiveId is required');

  const execId = toObjectId(executiveId);
  const current = yearBounds(year);
  const previous = yearBounds(current.year - 1);

  const [
    leadReport,
    leadReportPrev,
    tdStats,
    tdStatsPrev,
    monthly,
    recentBookings,
    totalLeadsAllTime,
    totalTdAllTime,
    accurateLeadCount,
    accurateLeadCountPrev,
  ] = await Promise.all([
    buildLeadAdminReport({ from: current.from, to: current.to, executiveId }),
    buildLeadAdminReport({ from: previous.from, to: previous.to, executiveId }),
    buildExecutiveTdStats({ executiveId, from: current.from, to: current.to }),
    buildExecutiveTdStats({ executiveId, from: previous.from, to: previous.to }),
    buildMonthlyBreakdown(executiveId, current.year),
    fetchRecentBookings(executiveId),
    Lead.countDocuments(assignedToStaffFilter(executiveId)),
    execId ? TDBooking.countDocuments({ assignedExecutive: execId }) : Promise.resolve(0),
    Lead.countDocuments({ ...assignedToStaffFilter(executiveId), ...createdAtFilter(current.from, current.to) }),
    Lead.countDocuments({ ...assignedToStaffFilter(executiveId), ...createdAtFilter(previous.from, previous.to) }),
  ]);

  leadReport.overview.totalLeads = accurateLeadCount;
  leadReportPrev.overview.totalLeads = accurateLeadCountPrev;

  return {
    year: current.year,
    compareYear: previous.year,
    period: { from: current.from, to: current.to },
    comparePeriod: { from: previous.from, to: previous.to },
    allTime: {
      totalLeads: totalLeadsAllTime,
      totalTestDrives: totalTdAllTime,
    },
    leads: {
      overview: leadReport.overview,
      pipeline: leadReport.pipeline,
      bySource: leadReport.bySource,
      byModel: leadReport.byModel,
      followUpSummary: leadReport.followUpSummary,
      leadDetailRows: leadReport.leadDetailRows.slice(0, 50),
      activityLog: leadReport.activityLog.slice(0, 30),
      feedbackRows: leadReport.feedbackRows.slice(0, 20),
    },
    leadsCompare: {
      overview: leadReportPrev.overview,
      pipeline: leadReportPrev.pipeline,
      bySource: leadReportPrev.bySource,
    },
    testDrives: tdStats,
    testDrivesCompare: tdStatsPrev,
    monthly,
    recentBookings,
    stages: leadReport.stages,
  };
}

/**
 * Sales Manager / team-lead dashboard: own assignments + reporting team stats.
 * Team = users under reportsTo subtree excluding self.
 */
async function buildManagerTeamDashboard({ admin, year } = {}) {
  if (!admin?._id) throw new Error('admin is required');

  const current = yearBounds(year);
  const personal = await buildExecutiveDashboard({ executiveId: admin._id, year: current.year });

  const selfIds = new Set([String(admin._id)]);
  const email = normalizeEmail(admin.email);
  if (email) {
    const twins = await TDStaff.find({ email }).select('_id').lean();
    for (const row of twins) selfIds.add(String(row._id));
  }

  const teamIds = await resolveStaffIdsForUser(admin);
  const reportIds = teamIds.filter((id) => !selfIds.has(String(id)));
  const mineIds = [...selfIds];

  const mineEmails = await resolveStaffEmailsForIds(mineIds, admin.email);
  const reportEmails = reportIds.length
    ? await resolveStaffEmailsForIds(reportIds, null)
    : [];
  const teamEmails = await resolveStaffEmailsForIds(teamIds, admin.email);

  const mineLeadFilter = assignedToIdsFilter(mineIds, admin.email, mineEmails);
  const reportLeadFilter = reportIds.length
    ? assignedToIdsFilter(reportIds, null, reportEmails)
    : { assignedTo: null };
  const teamLeadFilter = assignedToIdsFilter(teamIds, admin.email, teamEmails);

  const mineTdFilter = assignedExecutiveIdsFilter(mineIds, admin.email, mineEmails);
  const reportTdFilter = reportIds.length
    ? assignedExecutiveIdsFilter(reportIds, null, reportEmails)
    : { assignedExecutive: null };
  const teamTdFilter = assignedExecutiveIdsFilter(teamIds, admin.email, teamEmails);

  const now = new Date();
  const [
    myAssignedLeads,
    teamLeads,
    myAssignedTestDrives,
    teamTestDrives,
    pendingLeads,
    followUpsDue,
    completedTestDrivesMine,
    completedTestDrivesTeam,
    teamMembers,
  ] = await Promise.all([
    Lead.countDocuments(mineLeadFilter),
    reportIds.length ? Lead.countDocuments(reportLeadFilter) : Promise.resolve(0),
    TDBooking.countDocuments(mineTdFilter),
    reportIds.length ? TDBooking.countDocuments(reportTdFilter) : Promise.resolve(0),
    Lead.countDocuments({
      ...teamLeadFilter,
      status: { $nin: CLOSED_LEAD_STATUSES },
    }),
    Lead.countDocuments({
      ...teamLeadFilter,
      status: { $nin: CLOSED_LEAD_STATUSES },
      nextFollowUp: { $lte: now },
    }),
    TDBooking.countDocuments({ ...mineTdFilter, bookingStatus: 'COMPLETED' }),
    TDBooking.countDocuments({ ...teamTdFilter, bookingStatus: 'COMPLETED' }),
    reportIds.length
      ? TDStaff.find({ _id: { $in: reportIds.map((id) => toObjectId(id)).filter(Boolean) } })
          .select('name email designation role')
          .lean()
      : Promise.resolve([]),
  ]);

  const byMember = await Promise.all(
    (teamMembers || []).map(async (member) => {
      const mid = String(member._id);
      const memberEmails = await resolveStaffEmailsForIds([mid], member.email);
      const leadF = assignedToIdsFilter([mid], member.email, memberEmails);
      const tdF = assignedExecutiveIdsFilter([mid], member.email, memberEmails);
      const [leads, testDrives, completedTds, openLeads] = await Promise.all([
        Lead.countDocuments(leadF),
        TDBooking.countDocuments(tdF),
        TDBooking.countDocuments({ ...tdF, bookingStatus: 'COMPLETED' }),
        Lead.countDocuments({ ...leadF, status: { $nin: CLOSED_LEAD_STATUSES } }),
      ]);
      return {
        _id: mid,
        name: member.name,
        email: member.email,
        designation: member.designation,
        leads,
        openLeads,
        testDrives,
        completedTestDrives: completedTds,
      };
    }),
  );

  byMember.sort((a, b) => b.leads - a.leads || b.testDrives - a.testDrives);

  return {
    ...personal,
    reportType: 'manager',
    teamStats: {
      myAssignedLeads,
      myAssignedTestDrives,
      teamLeads,
      teamTestDrives,
      pendingLeads,
      followUpsDue,
      completedTestDrives: completedTestDrivesMine,
      teamCompletedTestDrives: completedTestDrivesTeam,
      teamSize: reportIds.length,
      byMember,
    },
  };
}

function isManagerDashboardUser(admin) {
  if (!admin) return false;
  if (isExecutiveScopedUser(admin)) return false;
  if (!isTeamScopedUser(admin)) return false;
  const designation = String(admin.designation || '').toLowerCase();
  return (
    admin.role === 'manager' ||
    ['sales_manager', 'sales_head', 'branch_manager'].includes(designation)
  );
}

module.exports = {
  buildExecutiveDashboard,
  buildManagerTeamDashboard,
  isManagerDashboardUser,
  yearBounds,
};
