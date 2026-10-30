/**
 * Management KPI counts shared by Detailed Report and Lead CRM Reports
 * (India MTD bounds + enquiry-date filters — same as detailedReportBuilder).
 */

const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDBooking = require('../models/TDBooking');
const { startOfDay, endOfDay, toDateKey } = require('./reportPeriod');
const { monthBoundsIndia } = require('./indiaDateTime');
const { appendLeadDateFilter } = require('./leadDateFilter');
const {
  sheetWalkInQuery,
  sheetDigitalQuery,
  sheetTdDoneQuery,
  sheetTdMonthRange,
} = require('./sheetCalculationLogic');

const ACTIVE_TD_BOOKING_FILTER = {
  bookingStatus: { $nin: ['CANCELLED', 'MISSED'] },
};

function dateRange(from, to) {
  return { $gte: from, $lte: to };
}

async function buildLeadScope(admin) {
  const { buildLeadQuery } = require('../controllers/leadCrmController');
  return buildLeadQuery(admin, {});
}

async function countLeads(scope, extra = {}, enquiryRange) {
  const q = { ...scope, ...extra };
  if (enquiryRange) {
    appendLeadDateFilter(q, {
      from: toDateKey(enquiryRange.from),
      to: toDateKey(enquiryRange.to),
      dateField: 'enquiry',
    });
  }
  return Lead.countDocuments(q);
}

async function countLeadsByStatus(scope, status, enquiryRange) {
  const statuses = Array.isArray(status) ? status : [status];
  return countLeads(scope, { status: { $in: statuses } }, enquiryRange);
}

/**
 * Same totals as Detailed Report summary (totalLeads / walkIn / digital + TD booking counts).
 */
async function buildAlignedManagementKpis(admin, now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const { mtdStart, mtdMonthEnd } = monthBoundsIndia(now);
  const todayRange = { from: todayStart, to: todayEnd };
  const mtdRange = { from: mtdStart, to: todayEnd };
  const walkInMtdRange = { from: mtdStart, to: mtdMonthEnd };

  const leadScope = await buildLeadScope(admin);
  const scopedLeadIds = await Lead.find(leadScope).distinct('_id');
  const hasScopedLeads = scopedLeadIds.length > 0;

  const [
    totalLeadsAll,
    totalLeadsMtd,
    totalLeadsToday,
    walkInAll,
    walkInMtd,
    walkInToday,
    digitalAll,
    digitalMtd,
    digitalToday,
    callsToday,
    tdMtdSheet,
    tdDoneTodaySheet,
    tdBookingsMtd,
    tdBookingsDoneToday,
    tdBookingsTodaySlot,
    followUpDueToday,
    overdueFollowUps,
    negotiationToday,
    negotiationMtd,
    bookingsToday,
    bookingsMtd,
    deliveriesToday,
    deliveriesMtd,
    lostToday,
    lostMtd,
    followUpPendingMtd,
  ] = await Promise.all([
    countLeads(leadScope),
    countLeads(leadScope, {}, mtdRange),
    countLeads(leadScope, {}, todayRange),
    countLeads(leadScope, sheetWalkInQuery()),
    countLeads(leadScope, sheetWalkInQuery(), walkInMtdRange),
    countLeads(leadScope, sheetWalkInQuery(), todayRange),
    countLeads(leadScope, sheetDigitalQuery()),
    countLeads(leadScope, sheetDigitalQuery(), mtdRange),
    countLeads(leadScope, sheetDigitalQuery(), todayRange),
    hasScopedLeads
      ? LeadFollowUp.countDocuments({
          leadId: { $in: scopedLeadIds },
          $or: [
            { completedAt: dateRange(todayStart, todayEnd) },
            { scheduledAt: dateRange(todayStart, todayEnd), status: 'pending' },
          ],
        })
      : 0,
    Lead.countDocuments({
      ...leadScope,
      ...sheetTdDoneQuery(),
      ...sheetTdMonthRange(mtdStart, mtdMonthEnd),
    }),
    Lead.countDocuments({
      ...leadScope,
      ...sheetTdDoneQuery(),
      ...sheetTdMonthRange(todayStart, todayEnd),
    }),
    TDBooking.countDocuments({
      ...ACTIVE_TD_BOOKING_FILTER,
      slotDate: dateRange(mtdStart, mtdMonthEnd),
    }),
    TDBooking.countDocuments({
      ...ACTIVE_TD_BOOKING_FILTER,
      bookingStatus: 'COMPLETED',
      slotDate: dateRange(todayStart, todayEnd),
    }),
    TDBooking.countDocuments({
      ...ACTIVE_TD_BOOKING_FILTER,
      slotDate: dateRange(todayStart, todayEnd),
    }),
    hasScopedLeads
      ? LeadFollowUp.countDocuments({
          leadId: { $in: scopedLeadIds },
          status: 'pending',
          scheduledAt: dateRange(todayStart, todayEnd),
        })
      : 0,
    hasScopedLeads
      ? LeadFollowUp.countDocuments({
          leadId: { $in: scopedLeadIds },
          status: 'pending',
          scheduledAt: { $lt: todayStart },
        })
      : 0,
    countLeadsByStatus(leadScope, 'Negotiation', todayRange),
    countLeadsByStatus(leadScope, 'Negotiation', mtdRange),
    countLeadsByStatus(leadScope, 'Booking', todayRange),
    countLeadsByStatus(leadScope, ['Booking', 'Delivered'], mtdRange),
    countLeadsByStatus(leadScope, 'Delivered', todayRange),
    countLeadsByStatus(leadScope, 'Delivered', mtdRange),
    countLeadsByStatus(leadScope, 'Lost', todayRange),
    countLeadsByStatus(leadScope, 'Lost', mtdRange),
    hasScopedLeads
      ? LeadFollowUp.countDocuments({
          leadId: { $in: scopedLeadIds },
          status: 'pending',
        })
      : 0,
  ]);

  const periodLabel = `MTD: ${toDateKey(mtdStart)} – ${toDateKey(now)}`;

  const summary = {
    totalLeads: { all: totalLeadsAll, mtd: totalLeadsMtd, today: totalLeadsToday },
    walkIn: { all: walkInAll, mtd: walkInMtd, today: walkInToday },
    digital: { all: digitalAll, mtd: digitalMtd, today: digitalToday },
  };

  const kpis = {
    today: {
      totalLeads: totalLeadsToday,
      walkIn: walkInToday,
      digital: digitalToday,
      followUpDue: followUpDueToday || callsToday,
      overdueFollowUps,
      tdBooked: tdBookingsTodaySlot,
      tdCompleted: tdBookingsDoneToday || tdDoneTodaySheet,
      negotiation: negotiationToday,
      bookings: bookingsToday,
      deliveries: deliveriesToday,
      lost: lostToday,
    },
    mtd: {
      totalLeads: totalLeadsMtd,
      walkIn: walkInMtd,
      digital: digitalMtd,
      followUpDue: followUpPendingMtd,
      overdueFollowUps,
      tdBooked: tdBookingsMtd,
      tdCompleted: tdMtdSheet,
      negotiation: negotiationMtd,
      bookings: bookingsMtd,
      deliveries: deliveriesMtd,
      lost: lostMtd,
    },
  };

  return {
    period: {
      label: periodLabel,
      mtdFrom: mtdStart.toISOString(),
      mtdTo: todayEnd.toISOString(),
      today: toDateKey(now),
    },
    summary,
    kpis,
  };
}

module.exports = {
  buildAlignedManagementKpis,
  buildLeadScope,
  countLeads,
};
