const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDBooking = require('../models/TDBooking');
const TDStaff = require('../models/TDStaff');
const { isWalkInSource } = require('./crmConversion');
const {
  sheetWalkInQuery,
  sheetDigitalQuery,
  sheetTdTillDateQuery,
  sheetTdDoneQuery,
  sheetBookingCountQuery,
} = require('./sheetCalculationLogic');
const { startOfDay, endOfDay, toDateKey } = require('./reportPeriod');
const { appendLeadDateFilter } = require('./leadDateFilter');
const { sheetConsultantAssignedExpr } = require('./leadUnassigned');
const { attributeLeadsBySheetConsultant } = require('./sheetConsultantStaffMatch');
const {
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

async function buildLeadScope(admin) {
  const scope = { isDuplicate: { $ne: true } };
  if (admin && isTeamScopedUser(admin) && !isUnrestrictedViewer(admin)) {
    scope.$and = [await assignedToStaffFilterAsync(admin)];
  }
  return scope;
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

async function buildDetailedReport({ admin } = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const mtdStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const mtdMonthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const yearStart = startOfDay(new Date(now.getFullYear(), 0, 1));

  const leadScope = await buildLeadScope(admin);
  const scopedLeadIds = await Lead.find(leadScope).distinct('_id');
  const todayRange = { from: todayStart, to: todayEnd };
  const mtdRange = { from: mtdStart, to: todayEnd };
  const walkInMtdRange = { from: mtdStart, to: mtdMonthEnd };

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
    sheetAttributionLeads,
    monthlyTdAgg,
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
    Lead.countDocuments({ ...leadScope, ...sheetBookingCountQuery() }),
    scopedLeadIds.length
      ? LeadFollowUp.countDocuments({
          leadId: { $in: scopedLeadIds },
          $or: [
            { completedAt: dateRange(todayStart, todayEnd) },
            { scheduledAt: dateRange(todayStart, todayEnd), status: 'pending' },
          ],
        })
      : Promise.resolve(0),
    Lead.countDocuments({ ...leadScope, ...sheetTdTillDateQuery() }),
    Lead.countDocuments({
      ...leadScope,
      ...sheetTdDoneQuery(),
      'creSheet.tdDate': dateRange(mtdStart, mtdMonthEnd),
    }),
    Lead.countDocuments({
      ...leadScope,
      ...sheetTdDoneQuery(),
      'creSheet.tdDate': dateRange(todayStart, todayEnd),
    }),
    Lead.aggregate([
      { $match: leadScope },
      {
        $group: {
          _id: { $ifNull: ['$source', 'Unknown'] },
          count: { $sum: 1 },
          assignedCount: {
            $sum: {
              $cond: [sheetConsultantAssignedExpr(), 1, 0],
            },
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
    Lead.find(leadScope)
      .select('source creSheet.salesConsultantName creSheet.tdDate creSheet.tdDone')
      .lean(),
    Lead.aggregate([
      {
        $match: {
          ...leadScope,
          ...sheetTdDoneQuery(),
          'creSheet.tdDate': dateRange(yearStart, todayEnd),
        },
      },
      { $group: { _id: { $month: '$creSheet.tdDate' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const {
    leadByStaff,
    tdByStaff: tdByStaffRaw,
    unassigned: unassignedSheet,
  } = attributeLeadsBySheetConsultant(sheetAttributionLeads, staffRows, {
    mtdStart,
    mtdMonthEnd,
  });
  const tdByStaff = new Map(
    [...tdByStaffRaw.entries()].map(([id, v]) => [id, { totalTd: v.totalTd, tdMtd: v.tdMtd }]),
  );

  /** Direct reports by manager id (active staff only). */
  const directReportsByManager = new Map();
  for (const s of staffRows) {
    if (!s.reportsTo) continue;
    const parent = String(s.reportsTo);
    if (!directReportsByManager.has(parent)) directReportsByManager.set(parent, []);
    directReportsByManager.get(parent).push(s);
  }

  /**
   * Excel "TD by team": SM = own TD + direct SE TD; SH = own TD only (not whole branch).
   */
  function teamStaffIdsForTdRollup(staff) {
    const root = String(staff._id);
    if (staff.designation === 'sales_head') {
      return [root];
    }
    if (MANAGER_DESIGNATIONS.has(staff.designation)) {
      const direct = directReportsByManager.get(root) || [];
      const execIds = direct
        .filter((r) => EXECUTIVE_DESIGNATIONS.has(r.designation))
        .map((r) => String(r._id));
      return [root, ...execIds];
    }
    return [root];
  }

  function teamTdTotalsForStaff(staff) {
    const ids = teamStaffIdsForTdRollup(staff);
    let teamTotal = 0;
    let teamMtd = 0;
    for (const id of ids) {
      const td = tdByStaff.get(id);
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
      const team = teamTdTotalsForStaff(s);
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
    unassignedSheet,
    attributionNote:
      'Staff lead and TD counts follow Excel SALES CONSULTANT on each lead (not CRM assignedTo). Unassigned = blank, Un-assigned, or consultant not matched to User Master.',
  };
}

function buildTeamMatrix({ staffRows, leadByStaff, matrixAgg, leadSources, now }) {
  const staffById = new Map(staffRows.map((s) => [String(s._id), s]));
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

  return {
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
}

async function buildTeamWiseAssignedLeadsReport({ admin } = {}) {
  const now = new Date();
  const todayEnd = endOfDay(now);
  const mtdStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const leadScope = await buildLeadScope(admin);

  const [sourceAgg, staffRows, sheetAttributionLeads] = await Promise.all([
    Lead.aggregate([
      { $match: leadScope },
      {
        $group: {
          _id: { $ifNull: ['$source', 'Unknown'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    TDStaff.find({ active: { $ne: false } })
      .select('name designation reportsTo email')
      .sort({ designation: 1, name: 1 })
      .lean(),
    Lead.find(leadScope).select('source creSheet.salesConsultantName creSheet.tdDate creSheet.tdDone').lean(),
  ]);

  const mtdMonthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const { leadByStaff, matrixAgg } = attributeLeadsBySheetConsultant(sheetAttributionLeads, staffRows, {
    mtdStart,
    mtdMonthEnd,
  });
  const leadSources = sourceAgg.map((r) => ({
    source: r._id || 'Unknown',
    count: r.count,
  }));
  const teamMatrix = buildTeamMatrix({ staffRows, leadByStaff, matrixAgg, leadSources, now });

  return {
    generatedAt: now.toISOString(),
    period: {
      mtdFrom: mtdStart.toISOString(),
      mtdTo: todayEnd.toISOString(),
      today: toDateKey(now),
      label: `All assigned leads · ${toDateKey(now)}`,
    },
    teamMatrix,
  };
}

module.exports = { buildDetailedReport, buildTeamWiseAssignedLeadsReport };
