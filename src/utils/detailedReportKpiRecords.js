const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDBooking = require('../models/TDBooking');
const ApiError = require('./apiError');
const { serializeLeadRow } = require('./detailedReportLeadDetails');
const { buildLeadScope, ACTIVE_TD_BOOKING_FILTER } = require('./detailedReportBuilder');
const {
  sheetWalkInQuery,
  sheetDigitalQuery,
  sheetBookingCountQuery,
} = require('./sheetCalculationLogic');
const { appendLeadDateFilter } = require('./leadDateFilter');
const { startOfDay, endOfDay, toDateKey } = require('./reportPeriod');
const { monthBoundsIndia } = require('./indiaDateTime');

const MAX_ROWS = 5000;

function normalizeKpi(raw) {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const map = {
    total_leads: 'totalLeads',
    totalleads: 'totalLeads',
    walk_in: 'walkIn',
    walkin: 'walkIn',
    digital: 'digital',
    digital_leads: 'digital',
    booking: 'booking',
    booking_count: 'booking',
    test_drive: 'testDrive',
    testdrive: 'testDrive',
    follow_ups: 'followUps',
    followups: 'followUps',
    calls: 'followUps',
  };
  return map[k] || k;
}

function normalizeScope(raw) {
  const s = String(raw || 'all')
    .trim()
    .toLowerCase();
  if (s === 'donetoday' || s === 'done_today') return 'doneToday';
  return s;
}

function reportPeriod(now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const { mtdStart: mtdStartIndia, mtdMonthEnd: mtdMonthEndIndia } = monthBoundsIndia(now);
  return {
    now,
    todayStart,
    todayEnd,
    mtdStart: mtdStartIndia,
    mtdMonthEnd: mtdMonthEndIndia,
    todayKey: toDateKey(now),
  };
}

function applyEnquiryScope(query, kpi, scope, period) {
  if (scope === 'all') return;
  let from;
  let to;
  if (scope === 'today') {
    from = period.todayStart;
    to = period.todayEnd;
  } else if (scope === 'mtd') {
    from = period.mtdStart;
    to = kpi === 'walkIn' ? period.mtdMonthEnd : period.todayEnd;
  } else {
    throw new ApiError(400, 'scope must be all, mtd, or today');
  }
  appendLeadDateFilter(query, {
    from: toDateKey(from),
    to: toDateKey(to),
    dateField: 'enquiry',
  });
}

async function fetchLeadKpiRecords(admin, kpi, scope) {
  const period = reportPeriod();
  const leadScope = await buildLeadScope(admin);
  const query = { ...leadScope };

  if (kpi === 'walkIn') Object.assign(query, sheetWalkInQuery());
  else if (kpi === 'digital') Object.assign(query, sheetDigitalQuery());
  else if (kpi === 'booking') Object.assign(query, sheetBookingCountQuery());
  else if (kpi !== 'totalLeads') throw new ApiError(400, 'Unknown lead KPI');

  applyEnquiryScope(query, kpi, scope, period);

  const docs = await Lead.find(query)
    .select(
      'name mobile model status source assignedTo assignedToEmail creSheet remarks nextFollowUp createdAt',
    )
    .populate({ path: 'assignedTo', select: 'name' })
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .lean();

  const rows = docs.map(serializeLeadRow);
  return {
    kind: 'leads',
    kpi,
    scope,
    rows,
    total: rows.length,
    truncated: docs.length >= MAX_ROWS,
  };
}

async function fetchTestDriveKpiRecords(admin, scope) {
  const period = reportPeriod();
  const q = { ...ACTIVE_TD_BOOKING_FILTER };

  if (scope === 'mtd') {
    q.slotDate = { $gte: period.mtdStart, $lte: period.mtdMonthEnd };
  } else if (scope === 'doneToday') {
    q.bookingStatus = 'COMPLETED';
    q.slotDate = { $gte: period.todayStart, $lte: period.todayEnd };
  } else if (scope !== 'all') {
    throw new ApiError(400, 'Test drive scope must be all, mtd, or doneToday');
  }

  const docs = await TDBooking.find(q)
    .select('slotDate bookingStatus customerName customerMobile leadId preferredModel')
    .populate({ path: 'leadId', select: 'model source name mobile' })
    .sort({ slotDate: -1 })
    .limit(MAX_ROWS)
    .lean();

  const rows = docs.map((b) => {
    const lead = b.leadId && typeof b.leadId === 'object' ? b.leadId : null;
    return {
      bookingId: String(b._id),
      slotDate: b.slotDate ? new Date(b.slotDate).toISOString() : null,
      bookingStatus: b.bookingStatus || '—',
      customerName: b.customerName || lead?.name || '—',
      customerMobile: b.customerMobile || lead?.mobile || '—',
      model: b.preferredModel || lead?.model || '—',
      source: lead?.source || '—',
      leadId: lead?._id ? String(lead._id) : null,
    };
  });

  return {
    kind: 'testDrives',
    kpi: 'testDrive',
    scope,
    rows,
    total: rows.length,
    truncated: docs.length >= MAX_ROWS,
  };
}

async function fetchFollowUpKpiRecords(admin) {
  const period = reportPeriod();
  const leadScope = await buildLeadScope(admin);
  const scopedLeadIds = await Lead.find(leadScope).distinct('_id');

  if (!scopedLeadIds.length) {
    return { kind: 'followUps', kpi: 'followUps', scope: 'today', rows: [], total: 0, truncated: false };
  }

  const docs = await LeadFollowUp.find({
    leadId: { $in: scopedLeadIds },
    $or: [
      { completedAt: { $gte: period.todayStart, $lte: period.todayEnd } },
      { scheduledAt: { $gte: period.todayStart, $lte: period.todayEnd }, status: 'pending' },
    ],
  })
    .populate('leadId', 'name mobile model')
    .populate('createdBy', 'name')
    .sort({ completedAt: -1, scheduledAt: -1, createdAt: -1 })
    .limit(MAX_ROWS)
    .lean();

  const rows = docs.map((f) => {
    const lead = f.leadId && typeof f.leadId === 'object' ? f.leadId : null;
    return {
      followUpId: String(f._id),
      leadId: lead?._id ? String(lead._id) : null,
      customerName: lead?.name || '—',
      customerMobile: lead?.mobile || '—',
      model: lead?.model || '—',
      note: f.note || '—',
      status: f.status || '—',
      scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : null,
      completedAt: f.completedAt ? new Date(f.completedAt).toISOString() : null,
      executive: f.createdBy?.name || '—',
    };
  });

  return {
    kind: 'followUps',
    kpi: 'followUps',
    scope: 'today',
    rows,
    total: rows.length,
    truncated: docs.length >= MAX_ROWS,
  };
}

async function fetchDetailedKpiRecords(admin, { kpi: rawKpi, scope: rawScope } = {}) {
  const kpi = normalizeKpi(rawKpi);
  const scope = normalizeScope(rawScope);

  if (!kpi) throw new ApiError(400, 'kpi query parameter is required');

  if (kpi === 'testDrive') return fetchTestDriveKpiRecords(admin, scope);
  if (kpi === 'followUps') return fetchFollowUpKpiRecords(admin);

  if (!['all', 'mtd', 'today'].includes(scope)) {
    throw new ApiError(400, 'scope must be all, mtd, or today for lead KPIs');
  }

  return fetchLeadKpiRecords(admin, kpi, scope);
}

module.exports = {
  fetchDetailedKpiRecords,
};
