const Lead = require('../models/Lead');
const { appendLeadDateFilter, appendBookingDateFilter, appendDeliveryDateFilter } = require('./leadDateFilter');
const { toDateKey } = require('./reportPeriod');
const { monthBoundsIndia, indiaDateKey } = require('./indiaDateTime');
const { appendInterestLevelFilter } = require('./leadInterestLevel');
const { crmBookingModuleMatch } = require('./leadModuleFilters');
const { buildLeadQuery } = require('../controllers/leadCrmController');

const LEAD_SCOPE = { isDuplicate: { $ne: true } };

const ACTIVE_TD_BOOKING_FILTER = {
  bookingStatus: { $nin: ['CANCELLED', 'MISSED'] },
};

function mergeScope(leadScope, extra) {
  return { $and: [leadScope, extra] };
}

/**
 * Shared date bounds + Mongo filters for dashboard KPI counts and drill-down lists.
 */
async function buildDashboardQueryContext(admin) {
  const leadScope = admin ? await buildLeadQuery(admin, {}) : { ...LEAD_SCOPE };

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(startOfDay);

  const { mtdStart, mtdMonthEnd } = monthBoundsIndia(now);
  const mtdFromKey = indiaDateKey(mtdStart);
  const mtdToKey = indiaDateKey(now);

  const newLeadsTodayQuery = { ...leadScope };
  appendLeadDateFilter(newLeadsTodayQuery, {
    from: todayKey,
    to: todayKey,
    dateField: 'enquiry',
  });

  const bookingBase = mergeScope(leadScope, crmBookingModuleMatch());
  const bookingMtdQuery = { ...bookingBase };
  appendBookingDateFilter(bookingMtdQuery, { from: mtdFromKey, to: mtdToKey });

  const deliveredBase = mergeScope(leadScope, { status: 'Delivered' });
  const deliveredMtdQuery = { ...deliveredBase };
  appendDeliveryDateFilter(deliveredMtdQuery, { from: mtdFromKey, to: mtdToKey });

  const testDrivesMtdQuery = {
    ...ACTIVE_TD_BOOKING_FILTER,
    slotDate: { $gte: mtdStart, $lte: mtdMonthEnd },
  };

  const tdPendingQuery = {
    ...ACTIVE_TD_BOOKING_FILTER,
    bookingStatus: { $in: ['PENDING', 'CONFIRMED', 'Pending', 'Scheduled'] },
  };

  return {
    leadScope,
    now,
    todayKey,
    mtdFromKey,
    mtdToKey,
    mtdStart,
    mtdMonthEnd,
    newLeadsTodayQuery,
    bookingBase,
    bookingMtdQuery,
    deliveredBase,
    deliveredMtdQuery,
    testDrivesMtdQuery,
    tdPendingQuery,
    activeTdFilter: { ...ACTIVE_TD_BOOKING_FILTER },
  };
}

/**
 * Resolve drill-down spec: { kind: 'leads'|'td'|'enquiries', query }.
 */
function resolveDashboardDrillSpec(ctx, metric, { status } = {}) {
  const m = String(metric || '').trim();
  switch (m) {
    case 'all-leads':
      return { kind: 'leads', query: ctx.leadScope };
    case 'leads-today':
      return { kind: 'leads', query: ctx.newLeadsTodayQuery };
    case 'hot-leads':
      return { kind: 'leads', query: appendInterestLevelFilter({ ...ctx.leadScope }, 'HOT') };
    case 'warm-leads':
      return { kind: 'leads', query: appendInterestLevelFilter({ ...ctx.leadScope }, 'WARM') };
    case 'cold-leads':
      return { kind: 'leads', query: appendInterestLevelFilter({ ...ctx.leadScope }, 'COLD') };
    case 'bookings':
      return { kind: 'leads', query: ctx.bookingBase };
    case 'bookings-mtd':
      return { kind: 'leads', query: ctx.bookingMtdQuery };
    case 'delivered':
      return { kind: 'leads', query: ctx.deliveredBase };
    case 'delivered-mtd':
      return { kind: 'leads', query: ctx.deliveredMtdQuery };
    case 'contact-pending':
      return { kind: 'leads', query: mergeScope(ctx.leadScope, { status: 'Contact Attempted' }) };
    case 'pending-followups':
      return { kind: 'leads', query: { ...ctx.leadScope, nextFollowUp: { $ne: null } } };
    case 'pipeline-status': {
      const st = String(status || '').trim();
      if (!st) return null;
      return { kind: 'leads', query: mergeScope(ctx.leadScope, { status: st }) };
    }
    case 'all-testdrives':
      return { kind: 'td', query: ctx.activeTdFilter };
    case 'test-drives-mtd':
      return { kind: 'td', query: ctx.testDrivesMtdQuery };
    case 'td-pending':
      return { kind: 'td', query: ctx.tdPendingQuery };
    case 'open-enquiries':
      return { kind: 'enquiries', query: { status: { $in: ['Open', 'In Progress'] } } };
    case 'all-enquiries':
      return { kind: 'enquiries', query: {} };
    default:
      return null;
  }
}

module.exports = {
  ACTIVE_TD_BOOKING_FILTER,
  mergeScope,
  buildDashboardQueryContext,
  resolveDashboardDrillSpec,
};
