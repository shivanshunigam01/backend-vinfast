/**
 * Shared booking/delivery report logic — aligned with Lead CRM Reports,
 * Detailed Report booking count, and CRE sheet date columns.
 */

const Lead = require('../models/Lead');
const TDStaff = require('../models/TDStaff');
const { normalizeStageLabel } = require('../constants/leadStages');
const { crmBookingModuleMatch } = require('./leadModuleFilters');
const { sheetBookingCountQuery } = require('./sheetCalculationLogic');
const { buildLeadScope, buildAlignedManagementKpis } = require('./leadManagementKpiBuilder');
const { appendBookingDateFilter, appendDeliveryDateFilter } = require('./leadDateFilter');
const { resolveAttributionStaff } = require('./sheetConsultantStaffMatch');
const { resolvePeriodRange, periodBucketKey, periodBucketUnit, toDateKey } = require('./reportPeriod');

const MANAGER_DESIGNATIONS = new Set(['sales_manager', 'sales_head', 'branch_manager']);
const EXECUTIVE_DESIGNATIONS = new Set(['sales_executive']);

const DESIGNATION_LABEL = {
  sales_executive: 'Sales Executive',
  sales_manager: 'Sales Manager',
  sales_head: 'Sales Head',
  branch_manager: 'Branch Manager',
  cre: 'CRE',
  crm: 'CRM',
};

function bump(map, key, amount = 1) {
  const k = key || 'Unknown';
  map[k] = (map[k] || 0) + amount;
}

function sortedCountEntries(map, labelKey) {
  return Object.entries(map)
    .map(([key, count]) => ({ [labelKey]: key, count }))
    .sort((a, b) => b.count - a.count || String(a[labelKey]).localeCompare(String(b[labelKey])));
}

function effectiveBookingDate(lead) {
  if (lead?.creSheet?.bookingDate) {
    const d = new Date(lead.creSheet.bookingDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const st = normalizeStageLabel(lead?.status);
  if (['Booking', 'Booked'].includes(st) && lead?.updatedAt) {
    const d = new Date(lead.updatedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (['Delivered'].includes(st) && lead?.creSheet?.deliveryDate) {
    const d = new Date(lead.creSheet.deliveryDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function effectiveDeliveryDate(lead) {
  if (lead?.creSheet?.deliveryDate) {
    const d = new Date(lead.creSheet.deliveryDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (lead?.creSheet?.retailDate) {
    const d = new Date(lead.creSheet.retailDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (lead?.convertedAt) {
    const d = new Date(lead.convertedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (normalizeStageLabel(lead?.status) === 'Delivered' && lead?.updatedAt) {
    const d = new Date(lead.updatedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function carModelOf(lead) {
  return lead?.creSheet?.finalModel || lead?.model || 'Unknown';
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

function teamStaffIdsForRollup(staff, directReportsByManager) {
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

function managerForStaff(staff, staffById, directReportsByManager) {
  if (!staff) return null;
  if (MANAGER_DESIGNATIONS.has(staff.designation)) return staff;
  let cursor = staff;
  const seen = new Set();
  while (cursor?.reportsTo && !seen.has(String(cursor.reportsTo))) {
    seen.add(String(cursor.reportsTo));
    const parent = staffById.get(String(cursor.reportsTo));
    if (!parent) break;
    if (MANAGER_DESIGNATIONS.has(parent.designation)) return parent;
    cursor = parent;
  }
  return null;
}

async function loadAlignedBookingDeliveryCounts(admin, now = new Date()) {
  const leadScope = await buildLeadScope(admin);
  const aligned = await buildAlignedManagementKpis(admin, now);
  const [bookingsAll, deliveriesAll] = await Promise.all([
    Lead.countDocuments({ ...leadScope, ...sheetBookingCountQuery() }),
    Lead.countDocuments({
      ...leadScope,
      status: { $in: ['Delivered', 'delivered'] },
    }),
  ]);
  return {
    bookings: {
      all: bookingsAll,
      mtd: aligned.kpis.mtd.bookings,
      today: aligned.kpis.today.bookings,
    },
    deliveries: {
      all: deliveriesAll,
      mtd: aligned.kpis.mtd.deliveries,
      today: aligned.kpis.today.deliveries,
    },
    leadReportPeriodLabel: aligned.period.label,
  };
}

function buildTeamBreakdown(staffRows, countByStaffId) {
  const directReportsByManager = buildDirectReportsMap(staffRows);
  const managers = staffRows.filter((s) => MANAGER_DESIGNATIONS.has(s.designation));
  const rows = [];

  for (const m of managers) {
    const memberIds = teamStaffIdsForRollup(m, directReportsByManager);
    let teamCount = 0;
    let ownCount = countByStaffId.get(String(m._id)) || 0;
    for (const id of memberIds) {
      teamCount += countByStaffId.get(id) || 0;
    }
    if (teamCount <= 0) continue;
    rows.push({
      managerId: String(m._id),
      managerName: m.name,
      designation: m.designation,
      ownCount,
      teamCount,
      directReports: Math.max(0, memberIds.length - 1),
    });
  }

  rows.sort((a, b) => b.teamCount - a.teamCount || a.managerName.localeCompare(b.managerName));
  return rows;
}

function aggregateAttributedRows(rows, staffRows) {
  const staffById = new Map(staffRows.map((s) => [String(s._id), s]));
  const directReportsByManager = buildDirectReportsMap(staffRows);

  const byExecutiveMap = {};
  const byModelMap = {};
  const bySourceMap = {};
  const byPeriodMap = {};
  const executiveMeta = {};
  const countByStaffId = new Map();

  for (const row of rows) {
    const lead = row.lead;
    const staff = resolveAttributionStaff(lead, staffRows);
    const execId = staff?._id ? String(staff._id) : 'unassigned';
    const execName = staff?.name || 'Unassigned';
    const manager = managerForStaff(staff, staffById, directReportsByManager);

    bump(byExecutiveMap, execId);
    countByStaffId.set(execId, (countByStaffId.get(execId) || 0) + 1);

    if (!executiveMeta[execId]) {
      executiveMeta[execId] = {
        executiveId: execId === 'unassigned' ? null : execId,
        name: execName,
        designation: staff?.designation ? DESIGNATION_LABEL[staff.designation] || staff.designation : null,
        teamManagerName: manager?.name || null,
        sheetConsultant: String(lead?.creSheet?.salesConsultantName || '').trim() || null,
      };
    }

    bump(byModelMap, row.carModel || carModelOf(lead));
    bump(bySourceMap, lead?.source || 'Unknown');
    bump(byPeriodMap, periodBucketKey(row.eventDate, row.periodKey));
  }

  const byExecutive = Object.keys(byExecutiveMap)
    .map((id) => ({
      ...executiveMeta[id],
      count: byExecutiveMap[id],
    }))
    .sort((a, b) => b.count - a.count || (a.name || '').localeCompare(b.name || ''));

  const executiveSum = byExecutive.reduce((s, r) => s + r.count, 0);

  return {
    byExecutive,
    byModel: sortedCountEntries(byModelMap, 'model'),
    bySource: sortedCountEntries(bySourceMap, 'source'),
    byPeriod: Object.entries(byPeriodMap)
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket)),
    byTeam: buildTeamBreakdown(staffRows, countByStaffId),
    breakdownTotals: {
      executiveSum,
      matchesPeriodTotal: executiveSum === rows.length,
    },
  };
}

async function loadPipelineReportContext({ admin, period, from, to, year, source } = {}) {
  const range = resolvePeriodRange({ period, from, to, year });
  const leadScope = await buildLeadScope(admin);
  const sourceFilter = source ? String(source).trim() : '';
  const useSource = sourceFilter && sourceFilter.toLowerCase() !== 'all';

  const staffRows = await TDStaff.find({ active: { $ne: false } })
    .select('name email designation reportsTo')
    .lean();

  const alignedCounts = await loadAlignedBookingDeliveryCounts(admin);

  return {
    range,
    leadScope,
    useSource,
    sourceFilter,
    staffRows,
    alignedCounts,
  };
}

function applySourceFilter(query, useSource, sourceFilter) {
  if (useSource) query.source = sourceFilter;
  return query;
}

module.exports = {
  MANAGER_DESIGNATIONS,
  effectiveBookingDate,
  effectiveDeliveryDate,
  carModelOf,
  loadAlignedBookingDeliveryCounts,
  loadPipelineReportContext,
  applySourceFilter,
  aggregateAttributedRows,
  appendBookingDateFilter,
  appendDeliveryDateFilter,
  crmBookingModuleMatch,
  periodBucketUnit,
  toDateKey,
};
