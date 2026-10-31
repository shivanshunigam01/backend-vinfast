const Lead = require('../models/Lead');
const Enquiry = require('../models/Enquiry');
const TDBooking = require('../models/TDBooking');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { buildCrmLeadStats } = require('../utils/crmStatsBuilder');
const {
  ACTIVE_TD_BOOKING_FILTER,
  buildDashboardQueryContext,
  resolveDashboardDrillQuery,
} = require('../utils/dashboardQueryContext');

function aggregateToRecord(rows) {
  const out = {};
  for (const row of rows || []) {
    const key = row?._id == null || row._id === '' ? 'Unknown' : String(row._id);
    out[key] = Number(row.count) || 0;
  }
  return out;
}

exports.getStats = asyncHandler(async (req, res) => {
  const ctx = await buildDashboardQueryContext(req.admin);

  const crmStats = await buildCrmLeadStats({
    admin: req.admin,
    leadQuery: ctx.leadScope,
    unassignedQuery: ctx.leadScope,
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [
    newLeadsToday,
    totalTestDrives,
    testDrivesThisWeek,
    testDrivesMtd,
    totalEnquiries,
    openEnquiries,
    hotLeads,
    bookings,
    bookingsMtd,
    delivered,
    deliveredMtd,
    pendingFollowUps,
    leadsBySourceAgg,
    leadsByModelAgg,
    testDrivesByStatusAgg,
  ] = await Promise.all([
    Lead.countDocuments(ctx.newLeadsTodayQuery),
    TDBooking.countDocuments(ACTIVE_TD_BOOKING_FILTER),
    TDBooking.countDocuments({ ...ACTIVE_TD_BOOKING_FILTER, createdAt: { $gte: weekStart } }),
    TDBooking.countDocuments(ctx.testDrivesMtdQuery),
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: { $in: ['Open', 'In Progress'] } }),
    Lead.countDocuments({ ...ctx.leadScope, status: { $in: ['Interested', 'Negotiation'] } }),
    Lead.countDocuments(ctx.bookingBase),
    Lead.countDocuments(ctx.bookingMtdQuery),
    Lead.countDocuments(ctx.deliveredBase),
    Lead.countDocuments(ctx.deliveredMtdQuery),
    Lead.countDocuments({ ...ctx.leadScope, nextFollowUp: { $ne: null } }),
    Lead.aggregate([{ $match: ctx.leadScope }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: ctx.leadScope }, { $group: { _id: '$model', count: { $sum: 1 } } }]),
    TDBooking.aggregate([
      { $match: ACTIVE_TD_BOOKING_FILTER },
      { $group: { _id: '$bookingStatus', count: { $sum: 1 } } },
    ]),
  ]);

  return successResponse(res, {
    totalLeads: crmStats.total,
    newLeadsToday,
    hotLeads,
    hotFlagLeads: crmStats.hotCount,
    warmFlagLeads: crmStats.warmCount,
    coldFlagLeads: crmStats.coldCount,
    bookings,
    bookingsMtd,
    delivered,
    deliveredMtd,
    pendingFollowUps,
    totalTestDrives,
    testDrivesThisWeek,
    testDrivesMtd,
    totalEnquiries,
    openEnquiries,
    leadsByStatus: crmStats.pipeline,
    crmPipelineStages: crmStats.stages,
    leadsBySource: aggregateToRecord(leadsBySourceAgg),
    leadsByModel: aggregateToRecord(leadsByModelAgg),
    testDrivesByStatus: aggregateToRecord(testDrivesByStatusAgg),
    period: {
      mtdFrom: ctx.mtdStart.toISOString(),
      mtdTo: ctx.now.toISOString(),
      mtdFromKey: ctx.mtdFromKey,
      mtdToKey: ctx.mtdToKey,
      todayKey: ctx.todayKey,
      label: `MTD: ${ctx.mtdFromKey} – ${ctx.mtdToKey}`,
    },
  });
});

/** GET /admin/dashboard/drill?metric=delivered-mtd — same filters as KPI counts. */
exports.getDashboardDrill = asyncHandler(async (req, res) => {
  const metric = String(req.query.metric || '').trim();
  const status = req.query.status != null ? String(req.query.status).trim() : undefined;
  const ctx = await buildDashboardQueryContext(req.admin);
  const spec = await resolveDashboardDrillQuery(ctx, metric, { status });
  if (!spec) {
    throw new ApiError(400, 'Unknown dashboard drill metric');
  }

  const { page, limit, skip } = buildPagination(req, { defaultLimit: 5000, maxLimit: 10000 });

  if (spec.kind === 'leads') {
    const [data, total] = await Promise.all([
      Lead.find(spec.query)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Lead.countDocuments(spec.query),
    ]);
    return successResponse(res, data, undefined, 200, { page, limit, total, kind: 'leads', metric });
  }

  if (spec.kind === 'td') {
    const [data, total] = await Promise.all([
      TDBooking.find(spec.query).sort({ slotDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      TDBooking.countDocuments(spec.query),
    ]);
    return successResponse(res, data, undefined, 200, { page, limit, total, kind: 'td', metric });
  }

  const [data, total] = await Promise.all([
    Enquiry.find(spec.query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Enquiry.countDocuments(spec.query),
  ]);
  return successResponse(res, data, undefined, 200, { page, limit, total, kind: 'enquiries', metric });
});
