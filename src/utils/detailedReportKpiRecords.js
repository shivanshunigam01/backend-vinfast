const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDBooking = require('../models/TDBooking');
const TDStaff = require('../models/TDStaff');
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
const {
  resolveAttributionStaff,
  isSheetTdCompleted,
  effectiveSheetTdDate,
} = require('./sheetConsultantStaffMatch');
const { normalizeLeadTypeForDetailedReport } = require('./leadTypeReport');

const MAX_ROWS = 5000;
const MANAGER_DESIGNATIONS = new Set(['sales_manager', 'sales_head', 'branch_manager']);
const EXECUTIVE_DESIGNATIONS = new Set(['sales_executive']);

function isSheetConsultantAssigned(lead) {
  const name = String(lead.creSheet?.salesConsultantName || '').trim();
  return Boolean(name && !/^un-assigned$/i.test(name));
}

function leadSourceLabel(lead) {
  return lead.source || 'Unknown';
}

function buildDirectReportsMap(staffRows) {
  const map = new Map();
  for (const s of staffRows) {
    if (!s.reportsTo) continue;
    const parent = String(s.reportsTo);
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(s);
  }
  return map;
}

function teamStaffIdsForTdRollup(staff, directReportsByManager) {
  const root = String(staff._id);
  if (staff.designation === 'sales_head') return [root];
  if (MANAGER_DESIGNATIONS.has(staff.designation)) {
    const direct = directReportsByManager.get(root) || [];
    const execIds = direct
      .filter((r) => EXECUTIVE_DESIGNATIONS.has(r.designation))
      .map((r) => String(r._id));
    return [root, ...execIds];
  }
  return [root];
}

async function loadScopedLeads(admin) {
  const leadScope = await buildLeadScope(admin);
  const docs = await Lead.find(leadScope)
    .select(
      'name mobile model status source assignedTo assignedToEmail creSheet remarks nextFollowUp createdAt leadType',
    )
    .populate({ path: 'assignedTo', select: 'name email' })
    .sort({ createdAt: -1 })
    .lean();
  return docs;
}

async function loadStaffRows() {
  return TDStaff.find({ active: { $ne: false } })
    .select('name designation reportsTo email')
    .lean();
}

function packLeadResult(rows, meta = {}) {
  return {
    kind: 'leads',
    rows: rows.slice(0, MAX_ROWS),
    total: rows.length,
    truncated: rows.length > MAX_ROWS,
    ...meta,
  };
}

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

async function fetchTableDrillRecords(admin, query = {}) {
  const table = String(query.table || '').trim();
  const period = reportPeriod();
  const [leads, staffRows] = await Promise.all([loadScopedLeads(admin), loadStaffRows()]);
  const directReportsByManager = buildDirectReportsMap(staffRows);
  const staffById = new Map(staffRows.map((s) => [String(s._id), s]));

  if (table === 'leadSource') {
    const source = query.source != null ? String(query.source) : null;
    const metric = String(query.metric || 'count').toLowerCase();
    const filtered = leads.filter((lead) => {
      if (source && leadSourceLabel(lead) !== source) return false;
      if (metric === 'assigned') return isSheetConsultantAssigned(lead);
      return true;
    });
    return packLeadResult(filtered.map(serializeLeadRow), {
      table,
      source,
      metric,
    });
  }

  if (table === 'leadType') {
    const leadType = query.leadType != null ? String(query.leadType) : null;
    const filtered = leads.filter((lead) => {
      const bucket = normalizeLeadTypeForDetailedReport(lead.leadType);
      if (!bucket) return false;
      if (leadType && bucket !== leadType) return false;
      return true;
    });
    return packLeadResult(filtered.map(serializeLeadRow), { table, leadType });
  }

  if (table === 'staff') {
    const staffId = String(query.staffId || '').trim();
    const metric = String(query.metric || 'leads').toLowerCase();
    if (!staffId) throw new ApiError(400, 'staffId is required');

    let staffFilter = null;
    if (staffId === '__managers__') {
      staffFilter = (staff) => staff && MANAGER_DESIGNATIONS.has(staff.designation);
    } else if (staffId === '__executives__') {
      staffFilter = (staff) => staff && EXECUTIVE_DESIGNATIONS.has(staff.designation);
    } else {
      const wantId = staffId;
      staffFilter = (staff) => staff && String(staff._id) === wantId;
    }

    const filtered = leads.filter((lead) => {
      const staff = resolveAttributionStaff(lead, staffRows);
      if (metric === 'leads') return staffFilter(staff);

      if (!isSheetTdCompleted(lead)) return false;
      const tdDate = effectiveSheetTdDate(lead);
      if (!tdDate) return false;

      if (metric === 'tdmtd') {
        if (tdDate < period.mtdStart || tdDate > period.mtdMonthEnd) return false;
      }

      if (metric === 'teamtd' || metric === 'teamtdmtd') {
        const anchor = staffById.get(staffId);
        if (!anchor) return false;
        const teamIds = new Set(teamStaffIdsForTdRollup(anchor, directReportsByManager));
        if (!staff || !teamIds.has(String(staff._id))) return false;
        if (metric === 'teamtdmtd') {
          if (tdDate < period.mtdStart || tdDate > period.mtdMonthEnd) return false;
        }
        return true;
      }

      return staffFilter(staff);
    });

    return packLeadResult(filtered.map(serializeLeadRow), { table, staffId, metric });
  }

  if (table === 'unassigned') {
    const metric = String(query.metric || 'leads').toLowerCase();
    const filtered = leads.filter((lead) => {
      const staff = resolveAttributionStaff(lead, staffRows);
      if (staff) return false;
      if (metric === 'leads') return true;
      if (!isSheetTdCompleted(lead)) return false;
      const tdDate = effectiveSheetTdDate(lead);
      if (!tdDate) return false;
      if (metric === 'tdmtd') {
        return tdDate >= period.mtdStart && tdDate <= period.mtdMonthEnd;
      }
      return true;
    });
    return packLeadResult(filtered.map(serializeLeadRow), { table, metric });
  }

  if (table === 'monthlyTd') {
    const year = query.year ? Number(query.year) : period.now.getFullYear();
    const monthNum = query.monthNum ? Number(query.monthNum) : null;
    const yearStart = startOfDay(new Date(year, 0, 1));
    let slotFrom = yearStart;
    let slotTo = period.todayEnd;
    if (monthNum >= 1 && monthNum <= 12) {
      slotFrom = startOfDay(new Date(year, monthNum - 1, 1));
      const monthEnd = endOfDay(new Date(year, monthNum, 0));
      slotTo = monthEnd > period.todayEnd ? period.todayEnd : monthEnd;
    }
    const q = {
      ...ACTIVE_TD_BOOKING_FILTER,
      slotDate: { $gte: slotFrom, $lte: slotTo },
    };
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
      table,
      year,
      monthNum,
      rows,
      total: rows.length,
      truncated: docs.length >= MAX_ROWS,
    };
  }

  throw new ApiError(400, 'Unknown table drill-down');
}

async function fetchDetailedKpiRecords(admin, query = {}) {
  const table = String(query.table || '').trim();
  if (table) return fetchTableDrillRecords(admin, query);

  const rawKpi = query.kpi;
  const rawScope = query.scope;
  const kpi = normalizeKpi(rawKpi);
  const scope = normalizeScope(rawScope);

  if (!kpi) throw new ApiError(400, 'kpi or table query parameter is required');

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
