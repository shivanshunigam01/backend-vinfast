require('../models/tdModels');

const mongoose = require('mongoose');
const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDFeedback = require('../models/TDFeedback');
const TDVehicle = require('../models/TDVehicle');
const TDCustomer = require('../models/TDCustomer');
const Lead = require('../models/Lead');
const { normalizeStageLabel } = require('../constants/leadStages');
const { extractCustomerFromBooking } = require('./tdCustomerResolver');

const CONVERTED_LEAD_STATUSES = ['Interested', 'Negotiation', 'Booking', 'Delivered', 'Booked'];

const { dateKeyRange } = require('./reportPeriod');

function buildDateFilter(from, to) {
  if (!from && !to) return {};
  return { slotDate: dateKeyRange(from, to) };
}

function isConvertedLead(status) {
  return CONVERTED_LEAD_STATUSES.includes(normalizeStageLabel(status));
}

function bookingMobile(booking) {
  const customer = booking.customerId;
  if (customer?.mobile) return String(customer.mobile).trim();
  const extracted = extractCustomerFromBooking(booking);
  return extracted?.mobile ? String(extracted.mobile).trim() : '';
}

function resolveLeadForBooking(booking, leadsByMobile) {
  const mobile = bookingMobile(booking);
  if (!mobile) return null;
  return leadsByMobile.get(mobile) || null;
}

async function buildAdminReport({ from, to, branchId } = {}) {
  const dateFilter = buildDateFilter(from, to);
  const branchFilter = branchId ? { branchId: new mongoose.Types.ObjectId(branchId) } : {};
  const baseFilter = { ...dateFilter, ...branchFilter };

  const feedbackDateFilter = from || to ? { createdAt: dateKeyRange(from, to) } : {};

  const [
    totalBookings,
    completed,
    pending,
    cancelled,
    missed,
    inProgress,
    totalCustomers,
    vehicleStats,
    feedbackStats,
    bookingsByStatus,
    bookingsByModel,
    bookingTrend,
    executivePerf,
    vehicles,
    bookings,
    feedbacks,
    logs,
  ] = await Promise.all([
    TDBooking.countDocuments(baseFilter),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'COMPLETED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: { $in: ['PENDING', 'CONFIRMED'] } }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'CANCELLED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'MISSED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'IN_PROGRESS' }),
    TDCustomer.countDocuments(),
    TDVehicle.aggregate([
      ...(branchId ? [{ $match: { branchId: new mongoose.Types.ObjectId(branchId) } }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    TDFeedback.aggregate([
      ...(Object.keys(feedbackDateFilter).length ? [{ $match: feedbackDateFilter }] : []),
      {
        $group: {
          _id: null,
          avgOverall: { $avg: '$overallRating' },
          avgPurchase: { $avg: '$purchaseIntention' },
          count: { $sum: 1 },
        },
      },
    ]),
    TDBooking.aggregate([{ $match: baseFilter }, { $group: { _id: '$bookingStatus', count: { $sum: 1 } } }]),
    TDBooking.aggregate([{ $match: baseFilter }, { $group: { _id: '$preferredModel', count: { $sum: 1 } } }]),
    TDBooking.aggregate([
      { $match: baseFilter },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$slotDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]),
    TDBooking.aggregate([
      { $match: { ...baseFilter, assignedExecutive: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$assignedExecutive',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'tdstaffs', localField: '_id', foreignField: '_id', as: 'executive' } },
      { $unwind: { path: '$executive', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$executive.name', total: 1, completed: 1 } },
      { $sort: { completed: -1 } },
      { $limit: 20 },
    ]),
    TDVehicle.find(branchFilter)
      .select('vehicleId model variant registrationNo color status availableAgainAt totalTestDrives totalTestDriveKM batteryPercent branchId')
      .populate('branchId', 'name code')
      .lean(),
    TDBooking.find(baseFilter)
      .populate('customerId', 'name mobile email')
      .populate('vehicleId', 'vehicleId model variant registrationNo color')
      .populate('assignedExecutive', 'name email')
      .populate('testDriveId', 'remarks customerName mobile model variant status feedback feedbackRating')
      .sort({ slotDate: -1 })
      .limit(500)
      .lean(),
    TDFeedback.find(feedbackDateFilter)
      .populate('customerId', 'name mobile')
      .populate({
        path: 'bookingId',
        select: 'bookingId slotDate slotTime preferredModel vehicleId assignedExecutive remarks',
        populate: [
          { path: 'vehicleId', select: 'vehicleId model registrationNo variant' },
          { path: 'assignedExecutive', select: 'name' },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    TDLog.find({ status: 'COMPLETED' })
      .populate('vehicleId', 'vehicleId model registrationNo')
      .populate('customerId', 'name mobile')
      .populate('bookingId', 'bookingId slotDate slotTime preferredModel')
      .populate('executiveId', 'name')
      .sort({ endTime: -1 })
      .limit(200)
      .lean(),
  ]);

  const bookingMobiles = [...new Set(bookings.map((b) => bookingMobile(b)).filter(Boolean))];
  const leadsByMobile = new Map();
  if (bookingMobiles.length) {
    const leads = await Lead.find({ mobile: { $in: bookingMobiles } })
      .sort({ updatedAt: -1 })
      .lean();
    for (const lead of leads) {
      if (!leadsByMobile.has(lead.mobile)) leadsByMobile.set(lead.mobile, lead);
    }
  }

  const feedbackByBooking = new Map();
  for (const fb of feedbacks) {
    const bookingRef = fb.bookingId;
    const bookingKey = bookingRef?._id || bookingRef;
    if (bookingKey) feedbackByBooking.set(String(bookingKey), fb);
  }

  const completionRate = totalBookings > 0 ? Math.round((completed / totalBookings) * 100) : 0;
  const vehicleStatusMap = Object.fromEntries(vehicleStats.map((v) => [v._id, v.count]));

  let leadsCreated = 0;
  let convertedCount = 0;

  const customerTestDriveLog = bookings.map((b) => {
    const customer = b.customerId;
    const fb = feedbackByBooking.get(String(b._id));
    const lead = resolveLeadForBooking(b, leadsByMobile);
    const leadStatus = lead?.status || null;
    const converted = leadStatus ? isConvertedLead(leadStatus) : false;
    if (b.bookingStatus === 'COMPLETED' && lead) {
      leadsCreated += 1;
      if (converted) convertedCount += 1;
    }

    return {
      bookingId: b.bookingId,
      bookingDbId: b._id,
      customerName: b.testDriveId?.customerName || customer?.name || b.customerName || '—',
      mobile: b.testDriveId?.mobile || customer?.mobile || b.customerMobile || '—',
      email: customer?.email || b.customerEmail || '—',
      model: b.testDriveId?.model || b.preferredModel || '—',
      variant: b.testDriveId?.variant || b.vehicleId?.variant || '—',
      vehicleLabel: b.vehicleId
        ? `${b.vehicleId.model} · ${b.vehicleId.registrationNo || b.vehicleId.vehicleId || '—'}`
        : 'Not assigned',
      vehicleId: b.vehicleId?.vehicleId || null,
      slotDate: b.slotDate,
      slotTime: b.slotTime,
      status: b.bookingStatus,
      executiveName: b.assignedExecutive?.name || '—',
      remarks: [b.remarks, b.testDriveId?.remarks].filter(Boolean).join(' | ') || '—',
      feedback: fb
        ? {
            overallRating: fb.overallRating,
            purchaseIntention: fb.purchaseIntention,
            drivingExperience: fb.drivingExperience,
            vehicleComfort: fb.vehicleComfort,
            batteryConfidence: fb.batteryConfidence,
            executiveBehaviour: fb.executiveBehaviour,
            preferredVariant: fb.preferredVariant,
            remarks: fb.remarks,
          }
        : null,
      leadId: lead?._id || null,
      leadStatus,
      converted,
    };
  });

  const vehicleWiseReport = vehicles.map((v) => {
    const vehicleBookings = bookings.filter(
      (b) => b.vehicleId && String(b.vehicleId._id || b.vehicleId) === String(v._id),
    );
    const completedForVehicle = vehicleBookings.filter((b) => b.bookingStatus === 'COMPLETED');
    const vehicleLogs = logs.filter(
      (l) => l.vehicleId && String(l.vehicleId._id || l.vehicleId) === String(v._id),
    );

    const customers = completedForVehicle.map((b) => {
      const fb = feedbackByBooking.get(String(b._id));
      const customer = b.customerId;
      const lead = resolveLeadForBooking(b, leadsByMobile);
      const log = vehicleLogs.find((l) => String(l.bookingId?._id || l.bookingId) === String(b._id));
      return {
        name: b.testDriveId?.customerName || customer?.name || b.customerName || '—',
        mobile: b.testDriveId?.mobile || customer?.mobile || b.customerMobile || '—',
        slotDate: b.slotDate,
        slotTime: b.slotTime,
        bookingId: b.bookingId,
        kmDriven: log?.totalKM ?? null,
        feedbackRating: fb?.overallRating ?? null,
        purchaseIntention: fb?.purchaseIntention ?? null,
        feedbackRemarks: fb?.remarks || '—',
        executiveRemarks: log?.executiveRemarks || '—',
        leadStatus: lead?.status || null,
        converted: lead?.status ? isConvertedLead(lead.status) : false,
      };
    });

    const ratings = customers.map((c) => c.feedbackRating).filter((r) => r != null);
    const avgRating = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    return {
      vehicleId: v.vehicleId,
      registrationNo: v.registrationNo || '—',
      model: v.model,
      variant: v.variant || '—',
      color: v.color || '—',
      status: v.status,
      availableAgainAt: v.availableAgainAt || null,
      batteryPercent: v.batteryPercent ?? 0,
      totalTestDrives: v.totalTestDrives || completedForVehicle.length,
      totalKM: v.totalTestDriveKM || 0,
      branchName: v.branchId?.name || '—',
      avgFeedbackRating: avgRating,
      completedDrives: completedForVehicle.length,
      scheduledBookings: vehicleBookings.filter((b) =>
        ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.bookingStatus),
      ).length,
      customers,
    };
  });

  const allFeedback = feedbacks.map((fb) => {
    const booking = fb.bookingId;
    const customer = fb.customerId;
    const mobile = customer?.mobile || '';
    const lead = mobile ? leadsByMobile.get(mobile) || null : null;
    return {
      createdAt: fb.createdAt,
      customerName: customer?.name || '—',
      mobile: customer?.mobile || '—',
      bookingId: booking?.bookingId || '—',
      slotDate: booking?.slotDate,
      slotTime: booking?.slotTime,
      model: booking?.preferredModel || '—',
      vehicleLabel: booking?.vehicleId
        ? `${booking.vehicleId.model} · ${booking.vehicleId.registrationNo || '—'}`
        : 'Not assigned',
      executiveName: booking?.assignedExecutive?.name || '—',
      overallRating: fb.overallRating,
      purchaseIntention: fb.purchaseIntention,
      drivingExperience: fb.drivingExperience,
      vehicleComfort: fb.vehicleComfort,
      batteryConfidence: fb.batteryConfidence,
      executiveBehaviour: fb.executiveBehaviour,
      preferredVariant: fb.preferredVariant,
      remarks: fb.remarks || '—',
      bookingRemarks: booking?.remarks || '—',
      leadStatus: lead?.status || null,
      converted: lead?.status ? isConvertedLead(lead.status) : false,
    };
  });

  const vehicleAvailability = vehicles.reduce((acc, v) => {
    const key = v.model || 'Unknown';
    if (!acc[key]) acc[key] = { model: key, total: 0, available: 0, booked: 0, other: 0 };
    acc[key].total += 1;
    if (v.status === 'AVAILABLE') acc[key].available += 1;
    else if (v.status === 'BOOKED') acc[key].booked += 1;
    else acc[key].other += 1;
    return acc;
  }, {});

  const leadConversionRate = completed > 0 ? Math.round((convertedCount / completed) * 100) : 0;

  const leadByStatus = {};
  for (const lead of leadsByMobile.values()) {
    const status = lead.status || 'Unknown';
    leadByStatus[status] = (leadByStatus[status] || 0) + 1;
  }

  const fb = feedbackStats[0] || { avgOverall: 0, avgPurchase: 0, count: 0 };

  return {
    overview: {
      totalBookings,
      completed,
      pending,
      cancelled,
      missed,
      inProgress,
      totalCustomers,
      completionRate,
      leadConversionRate,
      leadsFromTestDrives: leadsCreated,
      convertedToBusiness: convertedCount,
      feedbackCount: fb.count || 0,
    },
    vehicleFleet: vehicleStatusMap,
    vehicleAvailability: Object.values(vehicleAvailability),
    feedback: {
      avgOverall: fb.avgOverall ? Number(Number(fb.avgOverall).toFixed(1)) : 0,
      avgPurchase: fb.avgPurchase ? Number(Number(fb.avgPurchase).toFixed(1)) : 0,
      count: fb.count || 0,
    },
    charts: {
      bookingsByStatus: Object.fromEntries(bookingsByStatus.map((x) => [x._id, x.count])),
      bookingsByModel: Object.fromEntries(bookingsByModel.map((x) => [x._id || 'Unknown', x.count])),
      bookingTrend: bookingTrend.map((r) => ({ _id: r._id, count: r.count })),
      leadByStatus,
    },
    executivePerformance: executivePerf.map((row) => ({
      _id: String(row._id),
      name: row.name || 'Executive',
      total: row.total,
      completed: row.completed,
    })),
    topFeedback: allFeedback.slice(0, 10),
    allFeedback,
    customerTestDriveLog,
    vehicleWiseReport,
    driveLogs: logs.map((l) => ({
      bookingId: l.bookingId?.bookingId,
      customerName: l.customerId?.name,
      vehicleLabel: l.vehicleId ? `${l.vehicleId.model} · ${l.vehicleId.registrationNo || '—'}` : '—',
      totalKM: l.totalKM,
      durationMinutes: l.durationMinutes,
      executiveRemarks: l.executiveRemarks || '—',
      damageNotes: l.damageNotes || '—',
      endTime: l.endTime,
    })),
  };
}

module.exports = { buildAdminReport, isConvertedLead };
