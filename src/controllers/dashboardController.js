const Lead = require('../models/Lead');
const TestDrive = require('../models/TestDrive');
const Enquiry = require('../models/Enquiry');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { appendLeadDateFilter } = require('../utils/leadDateFilter');
const { toDateKey } = require('../utils/reportPeriod');

function aggregateToRecord(rows) {
  const out = {};
  for (const row of rows || []) {
    const key = row?._id == null || row._id === '' ? 'Unknown' : String(row._id);
    out[key] = Number(row.count) || 0;
  }
  return out;
}

exports.getStats = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(startOfDay);
  const newLeadsTodayQuery = { isDuplicate: { $ne: true } };
  appendLeadDateFilter(newLeadsTodayQuery, {
    from: todayKey,
    to: todayKey,
    dateField: 'enquiry',
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [
    totalLeads,
    newLeadsToday,
    totalTestDrives,
    testDrivesThisWeek,
    totalEnquiries,
    openEnquiries,
    hotLeads,
    bookings,
    pendingFollowUps,
    leadsByStatusAgg,
    leadsBySourceAgg,
    leadsByModelAgg,
    testDrivesByStatusAgg,
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments(newLeadsTodayQuery),
    TestDrive.countDocuments(),
    TestDrive.countDocuments({ createdAt: { $gte: weekStart } }),
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: { $in: ['Open', 'In Progress'] } }),
    Lead.countDocuments({ status: { $in: ['Interested', 'Negotiation'] } }),
    Lead.countDocuments({ status: 'Booked' }),
    Lead.countDocuments({ nextFollowUp: { $ne: null } }),
    Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $group: { _id: '$model', count: { $sum: 1 } } }]),
    TestDrive.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return successResponse(res, {
    totalLeads,
    newLeadsToday,
    hotLeads,
    bookings,
    pendingFollowUps,
    totalTestDrives,
    testDrivesThisWeek,
    totalEnquiries,
    openEnquiries,
    leadsByStatus: aggregateToRecord(leadsByStatusAgg),
    leadsBySource: aggregateToRecord(leadsBySourceAgg),
    leadsByModel: aggregateToRecord(leadsByModelAgg),
    testDrivesByStatus: aggregateToRecord(testDrivesByStatusAgg),
  });
});
