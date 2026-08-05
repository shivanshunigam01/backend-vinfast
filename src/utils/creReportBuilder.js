/**
 * Per-CRE performance report — leads this CRE created / assigned out
 * (not leads assigned *to* the CRE).
 */
const Lead = require('../models/Lead');
const TDStaff = require('../models/TDStaff');
const { CRM_LEAD_STAGES, normalizeStageLabel } = require('../constants/leadStages');
const { getActiveStageLabels } = require('./leadStageService');
const { toObjectId } = require('./leadAssignment');
const { resolvePeriodRange } = require('./reportPeriod');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function yearBounds(year) {
  const range = resolvePeriodRange({ period: 'yearly', year });
  return {
    year: range.year,
    from: range.fromDate,
    to: range.toDate,
    fromStr: range.from,
    toStr: range.to,
  };
}

function countMap(rows) {
  const out = {};
  for (const row of rows) {
    const key = row._id == null || row._id === '' ? 'Unknown' : String(row._id);
    out[key] = row.count;
  }
  return out;
}

async function buildCreReport({ creId, year, period, from, to } = {}) {
  const creObjectId = toObjectId(creId);
  if (!creObjectId) {
    throw new Error('CRE id is required');
  }

  const cre = await TDStaff.findById(creObjectId).select('name email designation role').lean();
  if (!cre) throw new Error('CRE user not found');

  const range = resolvePeriodRange({
    period: period || (from || to ? undefined : 'yearly'),
    from,
    to,
    year,
  });
  const current = {
    year: range.year,
    from: range.fromDate,
    to: range.toDate,
    fromStr: range.from,
    toStr: range.to,
  };
  const previous = yearBounds(current.year - 1);
  const baseMatch = { createdBy: creObjectId };
  const yearMatch = { ...baseMatch, createdAt: { $gte: current.from, $lte: current.to } };
  const prevMatch = { ...baseMatch, createdAt: { $gte: previous.from, $lte: previous.to } };

  const [
    totalCreatedAllTime,
    totalCreated,
    totalCreatedPrev,
    assignedCount,
    unassignedCount,
    byStatus,
    byLeadType,
    byArea,
    bySource,
    byExecutive,
    monthly,
    recentLeads,
  ] = await Promise.all([
    Lead.countDocuments(baseMatch),
    Lead.countDocuments(yearMatch),
    Lead.countDocuments(prevMatch),
    Lead.countDocuments({
      ...yearMatch,
      assignedTo: { $exists: true, $ne: null },
    }),
    Lead.countDocuments({
      ...yearMatch,
      $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
    }),
    Lead.aggregate([{ $match: yearMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: yearMatch },
      {
        $group: {
          _id: { $ifNull: ['$leadType', 'Unspecified'] },
          count: { $sum: 1 },
        },
      },
    ]),
    Lead.aggregate([
      { $match: yearMatch },
      {
        $group: {
          _id: { $ifNull: ['$area', { $ifNull: ['$city', 'Unknown'] }] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]),
    Lead.aggregate([{ $match: yearMatch }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([
      {
        $match: {
          ...yearMatch,
          assignedTo: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          count: { $sum: 1 },
          byLeadType: { $push: '$leadType' },
          byArea: { $push: { $ifNull: ['$area', '$city'] } },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Lead.aggregate([
      { $match: yearMatch },
      {
        $group: {
          _id: { $month: '$createdAt' },
          created: { $sum: 1 },
          assigned: {
            $sum: {
              $cond: [{ $ifNull: ['$assignedTo', false] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Lead.find(yearMatch)
      .populate('assignedTo', 'name email designation')
      .sort({ createdAt: -1 })
      .limit(40)
      .select('leadId name mobile city area address leadType status source model assignedTo createdAt')
      .lean(),
  ]);

  const staffIds = byExecutive.map((r) => r._id).filter(Boolean);
  const staffRows = staffIds.length
    ? await TDStaff.find({ _id: { $in: staffIds } }).select('name email designation').lean()
    : [];
  const staffMap = new Map(staffRows.map((s) => [String(s._id), s]));

  const byExecutiveRows = byExecutive.map((row) => {
    const staff = staffMap.get(String(row._id));
    const typeCounts = {};
    for (const t of row.byLeadType || []) {
      const key = t || 'Unspecified';
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    }
    const areaCounts = {};
    for (const a of row.byArea || []) {
      const key = a || 'Unknown';
      areaCounts[key] = (areaCounts[key] || 0) + 1;
    }
    return {
      executiveId: String(row._id),
      name: staff?.name || 'Unknown',
      email: staff?.email || '',
      designation: staff?.designation || '',
      assignedCount: row.count,
      byLeadType: typeCounts,
      byArea: areaCounts,
    };
  });

  const pipeline = {};
  const stageLabels = await getActiveStageLabels();
  for (const stage of stageLabels) pipeline[stage] = 0;
  for (const row of byStatus) {
    const stage = normalizeStageLabel(row._id);
    pipeline[stage] = (pipeline[stage] || 0) + row.count;
  }

  const monthlyRows = Array.from({ length: 12 }, (_, i) => {
    const found = monthly.find((m) => m._id === i + 1);
    return {
      month: i + 1,
      label: MONTH_LABELS[i],
      created: found?.created || 0,
      assigned: found?.assigned || 0,
    };
  });

  return {
    year: current.year,
    compareYear: previous.year,
    period: { period: range.period, from: current.fromStr, to: current.toStr },
    comparePeriod: { from: previous.fromStr, to: previous.toStr },
    cre: {
      _id: String(cre._id),
      name: cre.name,
      email: cre.email,
      designation: cre.designation,
    },
    overview: {
      totalCreatedAllTime,
      totalCreated,
      totalCreatedPrev,
      assigned: assignedCount,
      unassigned: unassignedCount,
      assignmentRate: totalCreated ? Math.round((assignedCount / totalCreated) * 100) : 0,
    },
    pipeline,
    byLeadType: countMap(byLeadType),
    byArea: countMap(byArea),
    bySource: countMap(bySource),
    byExecutive: byExecutiveRows,
    monthly: monthlyRows,
    recentLeads: recentLeads.map((l) => ({
      _id: String(l._id),
      leadId: l.leadId,
      name: l.name,
      mobile: l.mobile,
      city: l.city,
      area: l.area || l.city,
      address: l.address || '',
      leadType: l.leadType || '',
      status: l.status,
      source: l.source,
      model: l.model,
      assignedTo: l.assignedTo
        ? { _id: String(l.assignedTo._id), name: l.assignedTo.name, email: l.assignedTo.email }
        : null,
      createdAt: l.createdAt,
    })),
    stages: stageLabels,
  };
}

module.exports = { buildCreReport, yearBounds };
