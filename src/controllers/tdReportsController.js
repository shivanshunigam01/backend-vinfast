require('../models/tdModels');

const TDBooking = require('../models/TDBooking');
const TDCustomer = require('../models/TDCustomer');
const TDVehicle = require('../models/TDVehicle');
const TDFeedback = require('../models/TDFeedback');
const TDStaff = require('../models/TDStaff');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { buildDateRange } = require('../utils/queryBuilder');

function aggregateToRecord(rows) {
  const out = {};
  for (const row of rows || []) {
    const key = row._id == null || row._id === '' ? 'Unknown' : String(row._id);
    out[key] = Number(row.count) || 0;
  }
  return out;
}

exports.getAdminReport = asyncHandler(async (req, res) => {
  const range = buildDateRange(req.query.from, req.query.to);
  const match = range ? { createdAt: range } : {};

  const [
    statusAgg,
    modelAgg,
    trendAgg,
    totalCustomers,
    fleetAgg,
    feedbackAgg,
    execAgg,
    topFeedback,
  ] = await Promise.all([
    TDBooking.aggregate([{ $match: match }, { $group: { _id: '$bookingStatus', count: { $sum: 1 } } }]),
    TDBooking.aggregate([{ $match: match }, { $group: { _id: '$preferredModel', count: { $sum: 1 } } }]),
    TDBooking.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    TDCustomer.countDocuments(),
    TDVehicle.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    TDFeedback.aggregate([
      { $group: { _id: null, avgOverall: { $avg: '$overallRating' }, count: { $sum: 1 } } },
    ]),
    TDBooking.aggregate([
      { $match: { ...match, assignedExecutive: { $ne: null } } },
      {
        $group: {
          _id: '$assignedExecutive',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] },
          },
        },
      },
    ]),
    TDFeedback.find({})
      .sort({ overallRating: -1, createdAt: -1 })
      .limit(5)
      .populate('customerId', 'name'),
  ]);

  const bookingsByStatus = aggregateToRecord(statusAgg);
  const totalBookings = Object.values(bookingsByStatus).reduce((a, b) => a + b, 0);
  const completed = bookingsByStatus.COMPLETED || 0;
  const pending = (bookingsByStatus.PENDING || 0) + (bookingsByStatus.CONFIRMED || 0);
  const cancelled = bookingsByStatus.CANCELLED || 0;
  const missed = bookingsByStatus.MISSED || 0;
  const inProgress = bookingsByStatus.IN_PROGRESS || 0;

  const execIds = execAgg.map((e) => e._id).filter(Boolean);
  const execDocs = await TDStaff.find({ _id: { $in: execIds } }).select('name');
  const execNameMap = Object.fromEntries(execDocs.map((e) => [String(e._id), e.name]));

  const executivePerformance = execAgg.map((row) => ({
    _id: String(row._id),
    name: execNameMap[String(row._id)] || 'Executive',
    total: row.total,
    completed: row.completed,
  }));

  const fb = feedbackAgg[0] || { avgOverall: 0, count: 0 };

  return successResponse(res, {
    overview: {
      totalBookings,
      completed,
      pending,
      cancelled,
      missed,
      inProgress,
      totalCustomers,
      conversionRate: totalBookings ? Math.round((completed / totalBookings) * 100) : 0,
    },
    vehicleFleet: aggregateToRecord(fleetAgg),
    feedback: {
      avgOverall: fb.avgOverall ? Number(fb.avgOverall.toFixed(1)) : 0,
      count: fb.count || 0,
    },
    charts: {
      bookingsByStatus,
      bookingsByModel: aggregateToRecord(modelAgg),
      bookingTrend: trendAgg.map((r) => ({ _id: r._id, count: r.count })),
    },
    executivePerformance,
    topFeedback: topFeedback.map((f) => ({
      overallRating: f.overallRating,
      remarks: f.remarks,
      customerId: f.customerId ? { name: f.customerId.name } : null,
    })),
  });
});
