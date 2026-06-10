const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDFeedback = require('../models/TDFeedback');
const DemoVehicle = require('../models/DemoVehicle');
const Lead = require('../models/Lead');
const ChargingLog = require('../models/ChargingLog');
const RepairLog = require('../models/RepairLog');
const LeadStageHistory = require('../models/LeadStageHistory');
const asyncHandler = require('../utils/asyncHandler');

const dateRange = (from, to) => ({
  $gte: new Date(from || new Date(new Date().setDate(1))),
  $lte: new Date(to ? `${to}T23:59:59.999Z` : new Date())
});

// GET /admin/td/reports/daily
exports.dailyBookingReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const d = new Date(date || new Date().toDateString());
  const next = new Date(d); next.setDate(d.getDate() + 1);

  const [bookings, completed, cancelled, noShow] = await Promise.all([
    TDBooking.countDocuments({ preferredDate: { $gte: d, $lt: next } }),
    TDBooking.countDocuments({ preferredDate: { $gte: d, $lt: next }, status: 'Completed' }),
    TDBooking.countDocuments({ preferredDate: { $gte: d, $lt: next }, status: 'Cancelled' }),
    TDBooking.countDocuments({ preferredDate: { $gte: d, $lt: next }, status: 'No Show' })
  ]);

  const modelAgg = await TDBooking.aggregate([
    { $match: { preferredDate: { $gte: d, $lt: next } } },
    { $group: { _id: '$modelRequested', count: { $sum: 1 } } }
  ]);

  const slotAgg = await TDBooking.aggregate([
    { $match: { preferredDate: { $gte: d, $lt: next }, status: { $nin: ['Cancelled'] } } },
    { $group: { _id: '$slotStart', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      date: d.toDateString(),
      totalBookings: bookings,
      completed,
      cancelled,
      noShow,
      pending: bookings - completed - cancelled - noShow,
      completionRate: bookings ? Math.round((completed / bookings) * 100) : 0,
      byModel: Object.fromEntries(modelAgg.map(x => [x._id || 'Unknown', x.count])),
      bySlot: slotAgg
    }
  });
});

// GET /admin/td/reports/vehicle-utilization
exports.vehicleUtilizationReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const range = dateRange(from, to);

  const vehicles = await DemoVehicle.find({ active: true }).populate('assignedBranch', 'name');

  const tdCounts = await TDBooking.aggregate([
    { $match: { preferredDate: range, status: 'Completed', assignedVehicle: { $ne: null } } },
    { $group: { _id: '$assignedVehicle', completedTDs: { $sum: 1 } } }
  ]);
  const tdMap = Object.fromEntries(tdCounts.map(x => [x._id.toString(), x.completedTDs]));

  const data = vehicles.map(v => ({
    vehicleId: v.vehicleId,
    model: v.model,
    variant: v.variant,
    registrationNumber: v.registrationNumber,
    branch: v.assignedBranch?.name,
    status: v.status,
    batteryPct: v.batteryPercentage,
    totalKm: v.totalKmDriven,
    dailyKm: v.dailyKm,
    monthlyKm: v.monthlyKm,
    totalTDs: v.totalTestDrives,
    periodTDs: tdMap[v._id.toString()] || 0,
    totalChargingCycles: v.totalChargingCycles,
    replacementRecommended: v.replacementRecommended,
    depletionPct: Math.min(100, Math.round((v.totalKmDriven / v.depletionThresholdKm) * 100))
  }));

  res.json({ success: true, data });
});

// GET /admin/td/reports/executive-productivity
exports.executiveProductivityReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const range = dateRange(from, to);

  const agg = await TDBooking.aggregate([
    { $match: { createdAt: range, assignedExecutive: { $ne: null } } },
    {
      $group: {
        _id: '$assignedExecutive',
        totalAssigned: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$status', 'No Show'] }, 1, 0] } }
      }
    },
    { $lookup: { from: 'admins', localField: '_id', foreignField: '_id', as: 'exec' } },
    { $unwind: '$exec' },
    { $project: { executiveName: '$exec.name', executiveEmail: '$exec.email', totalAssigned: 1, completed: 1, cancelled: 1, noShow: 1, completionRate: { $cond: ['$totalAssigned', { $multiply: [{ $divide: ['$completed', '$totalAssigned'] }, 100] }, 0] } } }
  ]);

  res.json({ success: true, data: agg });
});

// GET /admin/td/reports/conversion
exports.conversionReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const range = dateRange(from, to);

  const [tdCompleted, booked, delivered] = await Promise.all([
    TDBooking.countDocuments({ createdAt: range, status: 'Completed' }),
    Lead.countDocuments({ status: 'Booked', createdAt: range }),
    Lead.countDocuments({ status: 'Delivered', createdAt: range })
  ]);

  const feedbackStats = await TDFeedback.aggregate([
    { $match: { createdAt: range } },
    { $group: { _id: null, interestedCount: { $sum: { $cond: ['$interestedToBuy', 1, 0] } }, total: { $sum: 1 }, avgRating: { $avg: '$overallRating' } } }
  ]);

  const stageMovements = await LeadStageHistory.aggregate([
    { $match: { createdAt: range } },
    { $group: { _id: '$toStage', count: { $sum: 1 } } }
  ]);

  res.json({
    success: true,
    data: {
      tdCompleted,
      interestedAfterTD: feedbackStats[0]?.interestedCount || 0,
      booked,
      delivered,
      avgFeedbackRating: feedbackStats[0]?.avgRating?.toFixed(1) || 'N/A',
      tdToBookingRate: tdCompleted ? Math.round((booked / tdCompleted) * 100) : 0,
      stageMovements: Object.fromEntries(stageMovements.map(x => [x._id, x.count]))
    }
  });
});

// GET /admin/td/reports/pending-followups
exports.pendingFollowupsReport = asyncHandler(async (req, res) => {
  const overdue = await TDLog.find({
    nextFollowUpDate: { $lte: new Date() },
    leadStageUpdatedTo: { $nin: ['Booking', 'Delivered', 'Lost'] }
  })
    .populate('booking', 'bookingRef customerName customerMobile modelRequested')
    .populate('executive', 'name email')
    .sort({ nextFollowUpDate: 1 })
    .limit(100);

  res.json({ success: true, total: overdue.length, data: overdue });
});

// GET /admin/td/reports/charging-repair
exports.chargingRepairReport = asyncHandler(async (req, res) => {
  const vehicles = await DemoVehicle.find({ active: true, $or: [{ status: 'Charging' }, { status: 'Under Repair' }, { status: 'Battery Low' }, { replacementRecommended: true }] }).populate('assignedBranch', 'name');

  const batteryLow = vehicles.filter(v => v.batteryPercentage <= v.batteryLowThreshold);
  const charging = vehicles.filter(v => v.status === 'Charging');
  const underRepair = vehicles.filter(v => v.status === 'Under Repair');
  const replacementDue = vehicles.filter(v => v.replacementRecommended);

  res.json({
    success: true,
    data: { batteryLow, charging, underRepair, replacementDue, summary: { batteryLowCount: batteryLow.length, chargingCount: charging.length, underRepairCount: underRepair.length, replacementDueCount: replacementDue.length } }
  });
});

// GET /admin/td/reports/fleet-depletion
exports.fleetDepletionReport = asyncHandler(async (req, res) => {
  const vehicles = await DemoVehicle.find({ active: true }).populate('assignedBranch', 'name city');

  const data = vehicles.map(v => {
    const depletionPct = Math.min(100, Math.round((v.totalKmDriven / v.depletionThresholdKm) * 100));
    let depletionStatus = 'Good';
    if (depletionPct >= 90) depletionStatus = 'Critical';
    else if (depletionPct >= 75) depletionStatus = 'Warning';
    else if (depletionPct >= 50) depletionStatus = 'Moderate';

    return {
      vehicleId: v.vehicleId, model: v.model, registrationNumber: v.registrationNumber,
      branch: v.assignedBranch?.name, totalKm: v.totalKmDriven, thresholdKm: v.depletionThresholdKm,
      depletionPct, depletionStatus, replacementRecommended: v.replacementRecommended,
      totalChargingCycles: v.totalChargingCycles, purchaseDate: v.purchaseDate,
      lastServiceAt: v.lastServiceAt
    };
  }).sort((a, b) => b.depletionPct - a.depletionPct);

  res.json({ success: true, data });
});

// GET /admin/td/reports/lost-reasons
exports.lostReasonReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const range = dateRange(from, to);

  const cancelled = await TDBooking.aggregate([
    { $match: { createdAt: range, status: 'Cancelled', cancellationReason: { $ne: null } } },
    { $group: { _id: '$cancellationReason', count: { $sum: 1 }, cancelledBy: { $first: '$cancelledBy' } } },
    { $sort: { count: -1 } }
  ]);

  const lostLeads = await Lead.countDocuments({ status: 'Lost', createdAt: range });

  res.json({ success: true, data: { cancelledBookings: cancelled, lostLeads, total: cancelled.length } });
});

// GET /admin/td/reports/summary — main dashboard summary
exports.reportSummary = asyncHandler(async (req, res) => {
  const today = new Date(new Date().toDateString());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    todayBookings, todayCompleted, monthBookings, monthCompleted,
    pendingApproval, pendingFollowups, vehiclesAvailable, vehiclesBusy, replacementDue
  ] = await Promise.all([
    TDBooking.countDocuments({ preferredDate: { $gte: today, $lt: tomorrow } }),
    TDBooking.countDocuments({ preferredDate: { $gte: today, $lt: tomorrow }, status: 'Completed' }),
    TDBooking.countDocuments({ createdAt: { $gte: monthStart } }),
    TDBooking.countDocuments({ createdAt: { $gte: monthStart }, status: 'Completed' }),
    TDBooking.countDocuments({ status: 'Pending Approval' }),
    TDLog.countDocuments({ nextFollowUpDate: { $lte: new Date() } }),
    DemoVehicle.countDocuments({ status: 'Available', active: true }),
    DemoVehicle.countDocuments({ status: { $in: ['Booked', 'Running', 'Charging', 'Under Repair'] }, active: true }),
    DemoVehicle.countDocuments({ replacementRecommended: true, active: true })
  ]);

  res.json({
    success: true,
    data: {
      today: { bookings: todayBookings, completed: todayCompleted },
      month: { bookings: monthBookings, completed: monthCompleted, completionRate: monthBookings ? Math.round((monthCompleted / monthBookings) * 100) : 0 },
      pendingApproval, pendingFollowups,
      fleet: { available: vehiclesAvailable, busy: vehiclesBusy, replacementDue }
    }
  });
});
