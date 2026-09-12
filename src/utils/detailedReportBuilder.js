const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDBooking = require('../models/TDBooking');
const TDStaff = require('../models/TDStaff');
const { WALK_IN_SOURCES, isWalkInSource } = require('./crmConversion');
const { startOfDay, endOfDay } = require('./reportPeriod');
const {
  collectSubtreeStaffIds,
  isTeamScopedUser,
  assignedToStaffFilterAsync,
  isUnrestrictedViewer,
} = require('./leadAssignment');

const MANAGER_DESIGNATIONS = new Set(['sales_manager', 'sales_head', 'branch_manager']);
const EXECUTIVE_DESIGNATIONS = new Set(['sales_executive']);
const MATRIX_DESIGNATIONS = new Set([
  'sales_executive',
  'sales_manager',
  'sales_head',
  'branch_manager',
]);

const DESIGNATION_ABBR = {
  sales_executive: 'SE',
  sales_manager: 'SM',
  sales_head: 'SH',
  branch_manager: 'BM',
  cre: 'CRE',
  crm: 'CRM',
  gm: 'GM',
  ceo: 'CEO',
  md: 'MD',
};

const TEAM_COLORS = [
  'bg-sky-100 dark:bg-sky-950/40',
  'bg-amber-100 dark:bg-amber-950/40',
  'bg-pink-100 dark:bg-pink-950/40',
  'bg-emerald-100 dark:bg-emerald-950/40',
  'bg-violet-100 dark:bg-violet-950/40',
  'bg-orange-100 dark:bg-orange-950/40',
  'bg-cyan-100 dark:bg-cyan-950/40',
  'bg-lime-100 dark:bg-lime-950/40',
];

function abbrFor(designation) {
  return DESIGNATION_ABBR[String(designation || '').trim()] || String(designation || 'ST').slice(0, 2).toUpperCase();
}

function dateRange(from, to) {
  return { $gte: from, $lte: to };
}

function walkInQuery() {
  return { source: { $in: [...WALK_IN_SOURCES] } };
}

function digitalQuery() {
  return { source: { $nin: [...WALK_IN_SOURCES] } };
}

async function buildLeadScope(admin) {
  const scope = { isDuplicate: { $ne: true } };
  if (admin && isTeamScopedUser(admin) && !isUnrestrictedViewer(admin)) {
    scope.$and = [await assignedToStaffFilterAsync(admin)];
  }
  return scope;
}

async function countLeads(scope, extra = {}, createdRange) {
  const q = { ...scope, ...extra };
  if (createdRange) q.createdAt = dateRange(createdRange.from, createdRange.to);
  return Lead.countDocuments(q);
}

async function buildDetailedReport({ admin } = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const mtdStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const yearStart = startOfDay(new Date(now.getFullYear(), 0, 1));

  const leadScope = await buildLeadScope(admin);
  const scopedLeadIds = await Lead.find(leadScope).distinct('_id');
  const todayRange = { from: todayStart, to: todayEnd };
  const mtdRange = { from: mtdStart, to: todayEnd };

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
    bookingCount,
    callsToday,
    tdAll,
    tdMtd,
    tdDoneToday,
    sourceAgg,
    leadTypeAgg,
    staffRows,
    leadByStaffAgg,
    tdByStaffAgg,
    matrixAgg,
    monthlyTdAgg,
  ] = await Promise.all([
    countLeads(leadScope),
    countLeads(leadScope, {}, mtdRange),
    countLeads(leadScope, {}, todayRange),
    countLeads(leadScope, walkInQuery()),
    countLeads(leadScope, walkInQuery(), mtdRange),
    countLeads(leadScope, walkInQuery(), todayRange),
    countLeads(leadScope, digitalQuery()),
    countLeads(leadScope, digitalQuery(), mtdRange),
    countLeads(leadScope, digitalQuery(), todayRange),
    Lead.countDocuments({ ...leadScope, status: { $in: ['Booking', 'Booked'] } }),
    scopedLeadIds.length
      ? LeadFollowUp.countDocuments({
          leadId: { $in: scopedLeadIds },
          $or: [
            { completedAt: dateRange(todayStart, todayEnd) },
            { createdAt: dateRange(todayStart, todayEnd) },
          ],
        })
      : Promise.resolve(0),
    TDBooking.countDocuments({ bookingStatus: { $ne: 'CANCELLED' } }),
    TDBooking.countDocuments({
      bookingStatus: { $ne: 'CANCELLED' },
      slotDate: dateRange(mtdStart, todayEnd),
    }),
    TDBooking.countDocuments({
      bookingStatus: 'COMPLETED',
      slotDate: dateRange(todayStart, todayEnd),
    }),
    Lead.aggregate([
      { $match: leadScope },
      {
        $group: {
          _id: { $ifNull: ['$source', 'Unknown'] },
          count: { $sum: 1 },
          assignedCount: {
            $sum: { $cond: [{ $ifNull: ['$assignedTo', false] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Lead.aggregate([
      { $match: { ...leadScope, leadType: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$leadType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    TDStaff.find({ active: { $ne: false } })
      .select('name designation reportsTo email')
      .sort({ designation: 1, name: 1 })
      .lean(),
    Lead.aggregate([
      { $match: { ...leadScope, assignedTo: { $exists: true, $ne: null } } },
      { $group: { _id: '$assignedTo', totalLeads: { $sum: 1 } } },
    ]),
    TDBooking.aggregate([
      { $match: { assignedExecutive: { $exists: true, $ne: null }, bookingStatus: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: '$assignedExecutive',
          totalTd: { $sum: 1 },
          tdMtd: {
            $sum: {
              $cond: [{ $and: [{ $gte: ['$slotDate', mtdStart] }, { $lte: ['$slotDate', todayEnd] }] }, 1, 0],
            },
          },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { ...leadScope, assignedTo: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { source: { $ifNull: ['$source', 'Unknown'] }, staffId: '$assignedTo' },
          count: { $sum: 1 },
        },
      },
    ]),
    TDBooking.aggregate([
      { $match: { slotDate: dateRange(yearStart, todayEnd), bookingStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: { $month: '$slotDate' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const leadByStaff = new Map(leadByStaffAgg.map((r) => [String(r._id), r.totalLeads]));
  const tdByStaff = new Map(
    tdByStaffAgg.map((r) => [String(r._id), { totalTd: r.totalTd, tdMtd: r.tdMtd }]),
  );

  const staffById = new Map(staffRows.map((s) => [String(s._id), s]));

  async function teamTdTotals(staffId) {
    const ids = await collectSubtreeStaffIds(staffId);
    let teamTotal = 0;
    let teamMtd = 0;
    for (const id of ids) {
      const td = tdByStaff.get(String(id));
      if (td) {
        teamTotal += td.totalTd;
        teamMtd += td.tdMtd;
      }
    }
    return { teamTotal, teamMtd };
  }

  const managers = [];
  const executives = [];

  for (const s of staffRows) {
    const id = String(s._id);
    const td = tdByStaff.get(id) || { totalTd: 0, tdMtd: 0 };
    const row = {
      staffId: id,
      name: s.name,
      designation: s.designation,
      abbr: abbrFor(s.designation),
      totalLeads: leadByStaff.get(id) || 0,
      totalTestDrive: td.totalTd,
      totalTestDriveMtd: td.tdMtd,
      teamTestDrive: 0,
      teamTestDriveMtd: 0,
    };

    if (MANAGER_DESIGNATIONS.has(s.designation)) {
      const team = await teamTdTotals(s._id);
      row.teamTestDrive = team.teamTotal;
      row.teamTestDriveMtd = team.teamMtd;
      managers.push(row);
    } else if (EXECUTIVE_DESIGNATIONS.has(s.designation)) {
      executives.push(row);
    }
  }

  managers.sort((a, b) => b.totalLeads - a.totalLeads);
  executives.sort((a, b) => b.totalLeads - a.totalLeads);

  const leadSources = sourceAgg.map((r) => ({
    source: r._id || 'Unknown',
    count: r.count,
    assignedCount: r.assignedCount,
    isWalkIn: isWalkInSource(r._id),
  }));

  const leadTypes = leadTypeAgg.map((r) => ({
    leadType: r._id || 'Unknown',
    count: r.count,
  }));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTestDrives = monthlyTdAgg.map((r) => ({
    month: monthNames[(r._id || 1) - 1],
    monthNum: r._id,
    count: r.count,
  }));
  const monthlyTdTotal = monthlyTestDrives.reduce((s, r) => s + r.count, 0);

  // Team-wise matrix columns (active sales staff only)
  const matrixStaff = staffRows.filter((s) => MATRIX_DESIGNATIONS.has(s.designation));
  const teamRoots = new Map();
  for (const s of matrixStaff) {
    let root = s;
    let cur = s;
    const seen = new Set();
    while (cur.reportsTo && !seen.has(String(cur.reportsTo))) {
      seen.add(String(cur.reportsTo));
      const mgr = staffById.get(String(cur.reportsTo));
      if (!mgr) break;
      root = mgr;
      cur = mgr;
    }
    const rootId = String(root._id);
    if (!teamRoots.has(rootId)) teamRoots.set(rootId, { manager: root, members: [] });
    teamRoots.get(rootId).members.push(s);
  }

  const teams = [];
  let colorIdx = 0;
  for (const [, team] of teamRoots) {
    team.members.sort((a, b) => {
      const rank = (d) => (MANAGER_DESIGNATIONS.has(d) ? 0 : 1);
      const dr = rank(a.designation) - rank(b.designation);
      return dr !== 0 ? dr : a.name.localeCompare(b.name);
    });
    const teamTotal = team.members.reduce((sum, m) => sum + (leadByStaff.get(String(m._id)) || 0), 0);
    teams.push({
      teamId: String(team.manager._id),
      managerName: team.manager.name,
      managerAbbr: abbrFor(team.manager.designation),
      colorClass: TEAM_COLORS[colorIdx % TEAM_COLORS.length],
      teamTotal,
      members: team.members.map((m) => ({
        staffId: String(m._id),
        name: m.name,
        abbr: abbrFor(m.designation),
        designation: m.designation,
        totalLeads: leadByStaff.get(String(m._id)) || 0,
      })),
    });
    colorIdx += 1;
  }
  teams.sort((a, b) => b.teamTotal - a.teamTotal);

  const matrixColumns = teams.flatMap((t) => t.members);
  const matrixByKey = new Map(
    matrixAgg.map((r) => [`${r._id.source}::${String(r._id.staffId)}`, r.count]),
  );

  const allSources = leadSources.map((r) => r.source);

  const teamMatrix = {
    teams,
    columns: matrixColumns,
    rows: allSources.map((source) => {
      const cells = {};
      let rowTotal = 0;
      for (const col of matrixColumns) {
        const c = matrixByKey.get(`${source}::${col.staffId}`) || 0;
        cells[col.staffId] = c;
        rowTotal += c;
      }
      return { source, cells, rowTotal };
    }),
    grandTotal: matrixColumns.reduce(
      (sum, col) => sum + (leadByStaff.get(col.staffId) || 0),
      0,
    ),
    columnTotals: Object.fromEntries(
      matrixColumns.map((col) => [col.staffId, leadByStaff.get(col.staffId) || 0]),
    ),
  };

  return {
    generatedAt: now.toISOString(),
    period: {
      mtdFrom: mtdStart.toISOString(),
      mtdTo: todayEnd.toISOString(),
      today: toDateKey(now),
      label: `MTD: ${toDateKey(mtdStart)} – ${toDateKey(now)}`,
    },
    summary: {
      totalLeads: { all: totalLeadsAll, mtd: totalLeadsMtd, today: totalLeadsToday },
      walkIn: { all: walkInAll, mtd: walkInMtd, today: walkInToday },
      digital: { all: digitalAll, mtd: digitalMtd, today: digitalToday },
      testDrives: { all: tdAll, mtd: tdMtd, doneToday: tdDoneToday },
      bookingCount,
      callsMadeToday: callsToday,
    },
    leadSources,
    leadSourcesTotal: {
      count: leadSources.reduce((s, r) => s + r.count, 0),
      assignedCount: leadSources.reduce((s, r) => s + r.assignedCount, 0),
    },
    salesManagers: managers,
    salesExecutives: executives,
    leadTypes,
    leadTypesTotal: leadTypes.reduce((s, r) => s + r.count, 0),
    monthlyTestDrives,
    monthlyTestDrivesTotal: monthlyTdTotal,
    teamMatrix,
  };
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { buildDetailedReport };
