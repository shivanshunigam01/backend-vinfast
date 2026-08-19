const Lead = require('../models/Lead');
const LeadFavourite = require('../models/LeadFavourite');
const TDBooking = require('../models/TDBooking');
const VehicleOrder = require('../models/VehicleOrder');
const { startOfDay, endOfDay, leadAgeInDays } = require('./crmConversion');
const { followUpHighlight } = require('./followUpSync');
const { favouriteLeadIdsForUser } = require('./crmStatsBuilder');
const { resolveStaffIdsForUser, assignedToStaffFilter } = require('./leadAssignment');

const PREVIEW_LIMIT = 50;

function displayName(lead) {
  return lead.customerName || lead.name || 'Customer';
}

function recommendedNextAction(row) {
  if (row.priority === 'critical' && row.bucket === 'overdueFollowUps') return 'Complete overdue follow-up';
  if (row.bucket === 'tdToday') return 'Conduct / confirm test drive';
  if (row.bucket === 'newEnquiries') return 'Make first contact';
  if (row.bucket === 'followUpToday') return 'Call customer today';
  if (row.bucket === 'bookingPending') return 'Close booking';
  if (row.bucket === 'deliveryPending') return 'Schedule / complete delivery';
  if (row.bucket === 'negotiation') return 'Update negotiation status';
  if (row.bucket === 'hotFavourite') return 'Work HOT lead';
  return 'Update lead';
}

async function annotateSuggestedHot(rowLists) {
  const LeadFollowUp = require('../models/LeadFollowUp');
  const mongoose = require('mongoose');
  const ids = new Set();
  for (const list of rowLists) {
    for (const r of list || []) {
      if (r?._id && r.bucket !== 'tdToday') ids.add(String(r._id));
    }
  }
  const objectIds = [...ids]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return;
  const counts = await LeadFollowUp.aggregate([
    { $match: { leadId: { $in: objectIds }, status: 'completed', interestLevel: 'HOT' } },
    { $group: { _id: '$leadId', n: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  for (const list of rowLists) {
    for (const r of list || []) {
      if ((map.get(String(r._id)) || 0) >= 2 && r.interestLevel !== 'HOT') {
        r.suggestedHot = true;
        r.recommendedNextAction = r.recommendedNextAction
          ? `${r.recommendedNextAction} · Suggest HOT`
          : 'Suggest marking as HOT';
      }
    }
  }
}

function priorityScore({ overdue, isHot, ageDays, newEnquiry, tdToday }) {
  let score = 0;
  if (overdue) score += 40;
  if (isHot) score += 25;
  if (ageDays >= 7) score += 20;
  else if (ageDays >= 3) score += 10;
  if (newEnquiry) score += 15;
  if (tdToday) score += 20;
  return score;
}

function toRow(lead, extras = {}) {
  const ageDays = leadAgeInDays(lead.createdAt);
  const highlight = followUpHighlight(lead.nextFollowUp);
  const isHot = extras.isHot || lead.interestLevel === 'HOT';
  const score = priorityScore({
    overdue: highlight === 'overdue',
    isHot,
    ageDays,
    newEnquiry: extras.bucket === 'newEnquiries',
    tdToday: extras.bucket === 'tdToday',
  });
  const row = {
    _id: String(lead._id),
    name: displayName(lead),
    mobile: lead.mobile,
    model: lead.model,
    status: lead.status,
    buyerType: lead.buyerType || '',
    remarks: lead.remarks || '',
    nextFollowUp: lead.nextFollowUp || null,
    followUpHighlight: highlight,
    assignedTo: lead.assignedTo
      ? { _id: String(lead.assignedTo._id || lead.assignedTo), name: lead.assignedTo.name || '' }
      : null,
    source: lead.source || '',
    interestLevel: lead.interestLevel || '',
    isFavourite: Boolean(extras.isFavourite || extras.isHot),
    ageDays,
    lastActivityAt: lead.lastActivityAt || lead.updatedAt,
    bucket: extras.bucket,
    priorityScore: score,
  };
  row.recommendedNextAction = recommendedNextAction(row);
  return row;
}

async function loadLeads(query, limit = PREVIEW_LIMIT) {
  return Lead.find(query)
    .populate('assignedTo', 'name email designation')
    .sort({ nextFollowUp: 1, lastActivityAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

async function buildActionCentre({ admin, leadQuery }) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowEnd = endOfDay(new Date(todayStart.getTime() + 24 * 60 * 60 * 1000));
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const open = { status: { $nin: ['Delivered', 'Lost', 'Not Interested'] } };

  const staffIds = await resolveStaffIdsForUser(admin);
  const favIds = await favouriteLeadIdsForUser(admin, staffIds);

  const queries = {
    newEnquiries: { ...leadQuery, status: 'Enquiry', $or: [{ firstRespondedAt: { $exists: false } }, { firstRespondedAt: null }] },
    followUpToday: { ...leadQuery, ...open, nextFollowUp: { $gte: todayStart, $lte: todayEnd } },
    overdueFollowUps: { ...leadQuery, ...open, nextFollowUp: { $lt: todayStart } },
    upcomingFollowUps: { ...leadQuery, ...open, nextFollowUp: { $gt: todayEnd, $lte: tomorrowEnd } },
    hotFavourite: favIds.length ? { ...leadQuery, ...open, _id: { $in: favIds } } : { _id: null },
    negotiation: { ...leadQuery, status: 'Negotiation' },
    bookingPending: { ...leadQuery, status: 'Booking' },
    newUpdates: {
      ...leadQuery,
      ...open,
      lastActivityAt: { $gte: startOfDay(now) },
    },
  };

  const countsEntries = await Promise.all(
    Object.entries(queries).map(async ([key, q]) => [key, await Lead.countDocuments(q)]),
  );
  const counts = Object.fromEntries(countsEntries);

  const tdFilter = {
    slotDate: { $gte: todayStart, $lte: todayEnd },
    bookingStatus: { $nin: ['CANCELLED'] },
  };
  if (staffIds?.length && admin?.userType !== 'admin' && admin?.role !== 'superadmin') {
    const { isUnrestrictedViewer } = require('./leadAssignment');
    if (!isUnrestrictedViewer(admin)) {
      tdFilter.assignedExecutive = { $in: staffIds };
    }
  }
  const tdTodayCount = await TDBooking.countDocuments(tdFilter);
  const tdDocs = await TDBooking.find(tdFilter)
    .populate('assignedExecutive', 'name')
    .populate('customerId', 'name mobile')
    .sort({ slotTime: 1 })
    .limit(PREVIEW_LIMIT)
    .lean();

  const deliveryOrders = await VehicleOrder.find({
    stage: { $nin: ['DELIVERED', 'CANCELLED'] },
  })
    .select('leadId stage')
    .limit(500)
    .lean();
  const deliveryLeadIds = deliveryOrders.map((o) => o.leadId).filter(Boolean);
  const deliveryPendingQuery = deliveryLeadIds.length
    ? { ...leadQuery, _id: { $in: deliveryLeadIds } }
    : { _id: null };
  counts.deliveryPending = await Lead.countDocuments(deliveryPendingQuery);
  counts.tdToday = tdTodayCount;

  const preview = {};
  for (const [key, q] of Object.entries(queries)) {
    const docs = await loadLeads(q);
    preview[key] = docs.map((l) =>
      toRow(l, {
        bucket: key,
        isFavourite: favIds.some((id) => String(id) === String(l._id)),
        isHot: key === 'hotFavourite' || l.interestLevel === 'HOT',
      }),
    );
  }
  preview.deliveryPending = (await loadLeads(deliveryPendingQuery)).map((l) =>
    toRow(l, { bucket: 'deliveryPending' }),
  );
  preview.tdToday = tdDocs.map((b) => ({
    _id: String(b._id),
    bookingId: b.bookingId,
    name: b.customerId?.name || b.customerName || 'Customer',
    mobile: b.customerId?.mobile || b.mobile || '',
    model: b.preferredModel || b.model || '',
    status: b.bookingStatus,
    slotDate: b.slotDate,
    slotTime: b.slotTime,
    assignedTo: b.assignedExecutive
      ? { _id: String(b.assignedExecutive._id), name: b.assignedExecutive.name }
      : null,
    bucket: 'tdToday',
    href: `/admin/td/bookings`,
    recommendedNextAction: 'Conduct / confirm test drive',
    priorityScore: 20,
  }));

  await annotateSuggestedHot(Object.values(preview));

  const critical = [
    ...preview.overdueFollowUps,
    ...preview.hotFavourite.filter((r) => {
      const last = r.lastActivityAt ? new Date(r.lastActivityAt) : null;
      return last && last < threeDaysAgo;
    }),
    ...preview.deliveryPending.filter((r) => r.ageDays >= 3),
  ];
  const dueToday = [...preview.followUpToday, ...preview.tdToday, ...preview.newEnquiries];
  const upcoming = [...preview.upcomingFollowUps];

  const seen = new Set();
  const uniq = (rows) =>
    rows.filter((r) => {
      const id = String(r._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  return {
    counts: {
      newEnquiries: counts.newEnquiries || 0,
      followUpToday: counts.followUpToday || 0,
      overdueFollowUps: counts.overdueFollowUps || 0,
      tdToday: counts.tdToday || 0,
      hotFavourite: counts.hotFavourite || 0,
      upcomingFollowUps: counts.upcomingFollowUps || 0,
      negotiation: counts.negotiation || 0,
      bookingPending: counts.bookingPending || 0,
      deliveryPending: counts.deliveryPending || 0,
      newUpdates: counts.newUpdates || 0,
    },
    preview,
    priority: {
      critical: uniq(critical).sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0)),
      dueToday: uniq(dueToday),
      upcoming: uniq(upcoming),
    },
  };
}

async function buildManagerActionGrid({ admin, leadQuery }) {
  const { resolveStaffIdsForUser, isExecutiveScopedUser } = require('./leadAssignment');
  const TDStaff = require('../models/TDStaff');
  const staffIds = await resolveStaffIdsForUser(admin);
  const members = await TDStaff.find({
    _id: { $in: staffIds },
    active: { $ne: false },
  })
    .select('name email designation')
    .lean();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const rows = [];
  for (const m of members) {
    const filter = assignedToStaffFilter(m._id, m.email);
    const open = { status: { $nin: ['Delivered', 'Lost', 'Not Interested'] } };
    const favIds = await LeadFavourite.find({ staffId: m._id }).select('leadId').lean();
    const favLeadIds = favIds.map((f) => f.leadId);
    const [newEnquiry, followUpToday, overdue, tdToday, hot, booking, delivery] = await Promise.all([
      Lead.countDocuments({ ...filter, status: 'Enquiry', $or: [{ firstRespondedAt: { $exists: false } }, { firstRespondedAt: null }] }),
      Lead.countDocuments({ ...filter, ...open, nextFollowUp: { $gte: todayStart, $lte: todayEnd } }),
      Lead.countDocuments({ ...filter, ...open, nextFollowUp: { $lt: todayStart } }),
      TDBooking.countDocuments({
        assignedExecutive: m._id,
        slotDate: { $gte: todayStart, $lte: todayEnd },
        bookingStatus: { $nin: ['CANCELLED'] },
      }),
      favLeadIds.length ? Lead.countDocuments({ ...filter, _id: { $in: favLeadIds } }) : 0,
      Lead.countDocuments({ ...filter, status: 'Booking' }),
      Lead.countDocuments({ ...filter, status: 'Booking', convertedAt: { $ne: null } }),
    ]);
    rows.push({
      _id: String(m._id),
      name: m.name,
      email: m.email,
      designation: m.designation,
      newEnquiry,
      followUpToday,
      overdue,
      tdToday,
      hot,
      booking,
      delivery,
    });
  }
  return { members: rows };
}

module.exports = { buildActionCentre, buildManagerActionGrid, toRow, priorityScore };
