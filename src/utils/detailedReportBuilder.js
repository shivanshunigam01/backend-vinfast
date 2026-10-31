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
  sheetTdMonthRange,
  sheetBookingCountQuery,
} = require('./sheetCalculationLogic');
const { startOfDay, endOfDay, toDateKey } = require('./reportPeriod');
const { monthBoundsIndia } = require('./indiaDateTime');

/** TD module bookings (includes VinFast CRM MTD imports). */
const ACTIVE_TD_BOOKING_FILTER = {
  bookingStatus: { $nin: ['CANCELLED', 'MISSED'] },
};
const { appendLeadDateFilter, leadEnquiryTemperatureFilter } = require('./leadDateFilter');
const {
  crmLeadAssignedExpr,
  sheetConsultantAssignedExpr,
  leadAssignedMongoFilter,
  leadUnassignedMongoFilter,
  sheetConsultantAssignedMongoFilter,
} = require('./leadUnassigned');
const { attributeLeadsBySheetConsultant } = require('./sheetConsultantStaffMatch');
const { bucketLeadTypeAggRows } = require('./leadTypeReport');
const { buildDetailedReportLeadDetails } = require('./detailedReportLeadDetails');

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

async function buildDetailedReport({ admin } = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const { mtdStart: mtdStartIndia, mtdMonthEnd: mtdMonthEndIndia } = monthBoundsIndia(now);
  const mtdStart = mtdStartIndia;
  const mtdMonthEnd = mtdMonthEndIndia;
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
    tdBookingsAll,
    tdBookingsMtd,
    tdBookingsDoneToday,
    sourceAgg,
    leadTypeAgg,
    staffRows,
    sheetAttributionLeads,
    monthlyTdAgg,
    crmAssignedTotal,
    crmUnassignedTotal,
    sheetConsultantNamedTotal,
    leadTemperatureHot,
    leadTemperatureWarm,
    leadTemperatureCold,
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
      ...sheetTdMonthRange(mtdStart, mtdMonthEnd),
    }),
    Lead.countDocuments({
      ...leadScope,
      ...sheetTdDoneQuery(),
      ...sheetTdMonthRange(todayStart, todayEnd),
    }),
    TDBooking.countDocuments(ACTIVE_TD_BOOKING_FILTER),
    TDBooking.countDocuments({
      ...ACTIVE_TD_BOOKING_FILTER,
      slotDate: dateRange(mtdStart, mtdMonthEnd),
    }),
    TDBooking.countDocuments({
      ...ACTIVE_TD_BOOKING_FILTER,
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
            $sum: {
              $cond: [crmLeadAssignedExpr(), 1, 0],
            },
          },
          sheetConsultantCount: {
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
      .select(
        'source assignedTo assignedToEmail creSheet.salesConsultantName creSheet.tdDate creSheet.tdDone creSheet.monthYearTd',
      )
      .populate({ path: 'assignedTo', select: 'name email' })
      .lean(),
    TDBooking.aggregate([
      {
        $match: {
          ...ACTIVE_TD_BOOKING_FILTER,
          slotDate: dateRange(yearStart, todayEnd),
        },
      },
      {
        $group: {
          _id: {
            $toInt: {
              $dateToString: { format: '%m', date: '$slotDate', timezone: 'Asia/Kolkata' },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Lead.countDocuments({ $and: [leadScope, leadAssignedMongoFilter()] }),
    Lead.countDocuments({ $and: [leadScope, leadUnassignedMongoFilter()] }),
    Lead.countDocuments({ $and: [leadScope, sheetConsultantAssignedMongoFilter()] }),
    Lead.countDocuments({ $and: [leadScope, leadEnquiryTemperatureFilter('hot', now)] }),
    Lead.countDocuments({ $and: [leadScope, leadEnquiryTemperatureFilter('warm', now)] }),
    Lead.countDocuments({ $and: [leadScope, leadEnquiryTemperatureFilter('cold', now)] }),
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

  function teamLeadTotalsForStaff(staff) {
    const ids = teamStaffIdsForTdRollup(staff);
    let teamTotal = 0;
    for (const id of ids) {
      teamTotal += leadByStaff.get(id) || 0;
    }
    return teamTotal;
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
      row.teamTotalLeads = teamLeadTotalsForStaff(s);
      managers.push(row);
    } else if (EXECUTIVE_DESIGNATIONS.has(s.designation)) {
      executives.push(row);
    }
  }

  managers.sort((a, b) => b.totalLeads - a.totalLeads);
  executives.sort((a, b) => b.totalLeads - a.totalLeads);

  const execById = new Map(executives.map((e) => [e.staffId, e]));
  const nestedExecutiveIds = new Set();

  function executiveRowForStaff(staff) {
    const id = String(staff._id);
    if (execById.has(id)) return execById.get(id);
    const td = tdByStaff.get(id) || { totalTd: 0, tdMtd: 0 };
    return {
      staffId: id,
      name: staff.name,
      designation: staff.designation,
      abbr: abbrFor(staff.designation),
      totalLeads: leadByStaff.get(id) || 0,
      totalTestDrive: td.totalTd,
      totalTestDriveMtd: td.tdMtd,
    };
  }

  /** Sales managers with direct-report executives nested (User Master reportsTo). */
  const salesManagerTeams = managers.map((mgr) => {
    const directExecStaff = (directReportsByManager.get(mgr.staffId) || []).filter((r) =>
      EXECUTIVE_DESIGNATIONS.has(r.designation),
    );
    const teamExecutives = directExecStaff
      .map((r) => {
        nestedExecutiveIds.add(String(r._id));
        return executiveRowForStaff(r);
      })
      .sort((a, b) => b.totalLeads - a.totalLeads);

    const executivesLeads = teamExecutives.reduce((s, e) => s + e.totalLeads, 0);
    const executivesTd = teamExecutives.reduce((s, e) => s + e.totalTestDrive, 0);
    const executivesTdMtd = teamExecutives.reduce((s, e) => s + e.totalTestDriveMtd, 0);

    return {
      manager: mgr,
      executives: teamExecutives,
      teamRollup: {
        managerOwnLeads: mgr.totalLeads,
        executivesLeads,
        teamTotalLeads: mgr.teamTotalLeads ?? mgr.totalLeads + executivesLeads,
        managerOwnTd: mgr.totalTestDrive,
        executivesTd,
        teamTotalTd: mgr.teamTestDrive ?? mgr.totalTestDrive + executivesTd,
        managerOwnTdMtd: mgr.totalTestDriveMtd,
        executivesTdMtd,
        teamTotalTdMtd: mgr.teamTestDriveMtd ?? mgr.totalTestDriveMtd + executivesTdMtd,
      },
    };
  });

  const orphanSalesExecutives = executives
    .filter((e) => !nestedExecutiveIds.has(e.staffId))
    .sort((a, b) => b.totalLeads - a.totalLeads);

  const managerIds = new Set(managers.map((m) => m.staffId));
  const execIds = new Set(executives.map((e) => e.staffId));
  let managersDirect = 0;
  let executivesTotal = 0;
  let otherStaff = 0;
  for (const m of managers) managersDirect += m.totalLeads;
  for (const e of executives) executivesTotal += e.totalLeads;
  for (const [id, count] of leadByStaff.entries()) {
    if (!managerIds.has(id) && !execIds.has(id)) otherStaff += count;
  }
  const sheetUnmatched = unassignedSheet?.totalLeads || 0;
  const attributionTotals = {
    grandTotal: totalLeadsAll,
    managersDirect,
    executives: executivesTotal,
    otherStaff,
    sheetUnmatched,
    attributedSubtotal: managersDirect + executivesTotal + otherStaff + sheetUnmatched,
    inBalance: managersDirect + executivesTotal + otherStaff + sheetUnmatched === totalLeadsAll,
  };

  const leadSources = sourceAgg.map((r) => ({
    source: r._id || 'Unknown',
    count: r.count,
    assignedCount: r.assignedCount,
    isWalkIn: isWalkInSource(r._id),
  }));

  const leadTypes = bucketLeadTypeAggRows(leadTypeAgg);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTestDrives = monthlyTdAgg.map((r) => ({
    month: monthNames[(r._id || 1) - 1],
    monthNum: r._id,
    count: r.count,
  }));
  const monthlyTdTotal = monthlyTestDrives.reduce((s, r) => s + r.count, 0);

  const drillDown = await buildDetailedReportLeadDetails({
    leadScope,
    scopedLeadIds,
    mtdStart,
    mtdMonthEnd,
    todayStart,
    todayEnd,
    yearStart,
    activeTdBookingFilter: ACTIVE_TD_BOOKING_FILTER,
  });

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
      testDrives: {
        all: tdBookingsAll,
        mtd: tdBookingsMtd,
        doneToday: tdBookingsDoneToday,
        sheetAll: tdAll,
        sheetMtd: tdMtd,
        sheetDoneToday: tdDoneToday,
      },
      bookingCount,
      callsMadeToday: callsToday,
      leadTemperature: {
        hot: leadTemperatureHot,
        warm: leadTemperatureWarm,
        cold: leadTemperatureCold,
      },
    },
    leadAssignment: {
      total: totalLeadsAll,
      crmAssigned: crmAssignedTotal,
      crmUnassigned: crmUnassignedTotal,
      sheetConsultantNamed: sheetConsultantNamedTotal,
      crmAssignedOnly: Math.max(0, crmAssignedTotal - sheetConsultantNamedTotal),
    },
    leadSources,
    leadSourcesTotal: {
      count: leadSources.reduce((s, r) => s + r.count, 0),
      assignedCount: leadSources.reduce((s, r) => s + r.assignedCount, 0),
    },
    salesManagers: managers,
    salesExecutives: executives,
    salesManagerTeams,
    orphanSalesExecutives,
    leadTypes,
    leadTypesTotal: leadTypes.reduce((s, r) => s + r.count, 0),
    monthlyTestDrives,
    monthlyTestDrivesTotal: monthlyTdTotal,
    unassignedSheet,
    attributionTotals,
    attributionNote:
      'Total Leads (All) = every lead in CRM. Each lead is attributed once by Excel SALES CONSULTANT (User Master). Sales Manager & Team table: manager row = that person’s sheet count; indented executives = direct reports; Team Leads / TD By Team = manager + those executives combined. Executives without a manager link appear under “Other executives”. Grand total = all managers (direct) + all executives + other staff + not matched. CRM Unassigned is a separate filter.',
    ...drillDown,
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
  const { mtdStart, mtdMonthEnd } = monthBoundsIndia(now);
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
    Lead.find(leadScope)
      .select(
        'source assignedTo assignedToEmail creSheet.salesConsultantName creSheet.tdDate creSheet.tdDone creSheet.monthYearTd',
      )
      .populate({ path: 'assignedTo', select: 'name email' })
      .lean(),
  ]);

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

module.exports = {
  buildDetailedReport,
  buildTeamWiseAssignedLeadsReport,
  buildLeadScope,
  ACTIVE_TD_BOOKING_FILTER,
};
