const Lead = require('../models/Lead');
const TestDrive = require('../models/TestDrive');
const Enquiry = require('../models/Enquiry');
const asyncHandler = require('../utils/asyncHandler');

exports.getStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalLeads,
    newLeadsToday,
    hotLeads,
    bookings,
    pendingFollowUps,
    totalTestDrives,
    testDrivesThisWeek,
    totalEnquiries,
    openEnquiries,
    sourceAgg,
    modelAgg,
    leadStatusAgg,
    testDriveStatusAgg
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ createdAt: { $gte: today } }),
    Lead.countDocuments({ status: { $in: ['Interested', 'Negotiation'] } }),
    Lead.countDocuments({ status: 'Booked' }),
    Lead.countDocuments({ nextFollowUp: { $lte: new Date() } }),
    TestDrive.countDocuments(),
    TestDrive.countDocuments({ createdAt: { $gte: weekStart } }),
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: 'Open' }),
    Lead.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $group: { _id: '$model', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    TestDrive.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);

  const toObject = (arr) => Object.fromEntries(arr.filter(Boolean).map((x) => [x._id || 'Unknown', x.count]));

  res.json({
    success: true,
    data: {
      totalLeads,
      newLeadsToday,
      hotLeads,
      bookings,
      pendingFollowUps,
      totalTestDrives,
      testDrivesThisWeek,
      totalEnquiries,
      openEnquiries,
      leadsBySource: toObject(sourceAgg),
      leadsByModel: toObject(modelAgg),
      leadsByStatus: toObject(leadStatusAgg),
      testDrivesByStatus: toObject(testDriveStatusAgg)
    }
  });
});
