const Lead = require('../models/Lead');
const Enquiry = require('../models/Enquiry');
const TDBooking = require('../models/TDBooking');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { appendLeadDateFilter, appendBookingDateFilter, appendDeliveryDateFilter } = require('../utils/leadDateFilter');
const { toDateKey } = require('../utils/reportPeriod');
const { monthBoundsIndia } = require('../utils/indiaDateTime');
const { appendInterestLevelFilter } = require('../utils/leadInterestLevel');
const { crmBookingModuleMatch } = require('../utils/leadModuleFilters');
const { buildLeadQuery } = require('./leadCrmController');

const LEAD_SCOPE = { isDuplicate: { $ne: true } };

const ACTIVE_TD_BOOKING_FILTER = {
  bookingStatus: { $nin: ['CANCELLED', 'MISSED'] },
};

function aggregateToRecord(rows) {
  const out = {};
  for (const row of rows || []) {
    const key = row?._id == null || row._id === '' ? 'Unknown' : String(row._id);
    out[key] = Number(row.count) || 0;
  }
  return out;
}

function mergeScope(leadScope, extra) {
  return { $and: [leadScope, extra] };
}

exports.getStats = asyncHandler(async (req, res) => {
  const leadScope = req.admin ? await buildLeadQuery(req.admin, {}) : { ...LEAD_SCOPE };

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(startOfDay);
  const { mtdStart, mtdMonthEnd } = monthBoundsIndia(now);
  const mtdFromKey = toDateKey(mtdStart);
  const mtdToKey = toDateKey(now);

  const newLeadsTodayQuery = { ...leadScope };
  appendLeadDateFilter(newLeadsTodayQuery, {
    from: todayKey,
    to: todayKey,
    dateField: 'enquiry',
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const bookingBase = mergeScope(leadScope, crmBookingModuleMatch());
  const bookingMtdQuery = { ...bookingBase };
  appendBookingDateFilter(bookingMtdQuery, { from: mtdFromKey, to: mtdToKey });

  const deliveredBase = mergeScope(leadScope, { status: 'Delivered' });
  const deliveredMtdQuery = { ...deliveredBase };
  appendDeliveryDateFilter(deliveredMtdQuery, { from: mtdFromKey, to: mtdToKey });

  const [
    totalLeads,
    newLeadsToday,
    totalTestDrives,
    testDrivesThisWeek,
    testDrivesMtd,
    totalEnquiries,
    openEnquiries,
    hotLeads,
    hotFlagLeads,
    warmFlagLeads,
    coldFlagLeads,
    bookings,
    bookingsMtd,
    delivered,
    deliveredMtd,
    pendingFollowUps,
    leadsByStatusAgg,
    leadsBySourceAgg,
    leadsByModelAgg,
    testDrivesByStatusAgg,
  ] = await Promise.all([
    Lead.countDocuments(leadScope),
    Lead.countDocuments(newLeadsTodayQuery),
    TDBooking.countDocuments(ACTIVE_TD_BOOKING_FILTER),
    TDBooking.countDocuments({ ...ACTIVE_TD_BOOKING_FILTER, createdAt: { $gte: weekStart } }),
    TDBooking.countDocuments({
      ...ACTIVE_TD_BOOKING_FILTER,
      slotDate: { $gte: mtdStart, $lte: mtdMonthEnd },
    }),
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: { $in: ['Open', 'In Progress'] } }),
    Lead.countDocuments({ ...leadScope, status: { $in: ['Interested', 'Negotiation'] } }),
    Lead.countDocuments(appendInterestLevelFilter({ ...leadScope }, 'HOT')),
    Lead.countDocuments(appendInterestLevelFilter({ ...leadScope }, 'WARM')),
    Lead.countDocuments(appendInterestLevelFilter({ ...leadScope }, 'COLD')),
    Lead.countDocuments(bookingBase),
    Lead.countDocuments(bookingMtdQuery),
    Lead.countDocuments(deliveredBase),
    Lead.countDocuments(deliveredMtdQuery),
    Lead.countDocuments({ ...leadScope, nextFollowUp: { $ne: null } }),
    Lead.aggregate([{ $match: leadScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: leadScope }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: leadScope }, { $group: { _id: '$model', count: { $sum: 1 } } }]),
    TDBooking.aggregate([
      { $match: ACTIVE_TD_BOOKING_FILTER },
      { $group: { _id: '$bookingStatus', count: { $sum: 1 } } },
    ]),
  ]);

  return successResponse(res, {
    totalLeads,
    newLeadsToday,
    hotLeads,
    hotFlagLeads,
    warmFlagLeads,
    coldFlagLeads,
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
    leadsByStatus: aggregateToRecord(leadsByStatusAgg),
    leadsBySource: aggregateToRecord(leadsBySourceAgg),
    leadsByModel: aggregateToRecord(leadsByModelAgg),
    testDrivesByStatus: aggregateToRecord(testDrivesByStatusAgg),
    period: {
      mtdFrom: mtdStart.toISOString(),
      mtdTo: now.toISOString(),
      label: `MTD: ${mtdFromKey} – ${mtdToKey}`,
    },
  });
});
