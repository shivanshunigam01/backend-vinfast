const Lead = require('../models/Lead');
const { normalizeStageLabel } = require('../constants/leadStages');
const { resolvePeriodRange, periodBucketKey, periodBucketUnit } = require('./reportPeriod');

function deliveryDateOf(lead) {
  if (lead.convertedAt) return new Date(lead.convertedAt);
  if (lead.creSheet?.deliveryDate) return new Date(lead.creSheet.deliveryDate);
  if (lead.updatedAt) return new Date(lead.updatedAt);
  return null;
}

function bump(map, key, amount = 1) {
  const k = key || 'Unknown';
  map[k] = (map[k] || 0) + amount;
}

function sortedCountEntries(map) {
  return Object.entries(map)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Delivery report: leads in Delivered stage, dated by
 * convertedAt || creSheet.deliveryDate || updatedAt.
 */
async function buildDeliveryReport({ period, from, to, year } = {}) {
  const range = resolvePeriodRange({ period, from, to, year });
  const fromMs = range.fromDate.getTime();
  const toMs = range.toDate.getTime();

  // Pull delivered leads (canonical + common aliases); filter by delivery date in JS.
  const candidates = await Lead.find({
    status: { $in: ['Delivered', 'delivered'] },
    isDuplicate: { $ne: true },
  })
    .populate('assignedTo', 'name email designation')
    .select(
      'name mobile model source status assignedTo convertedAt creSheet.deliveryDate updatedAt createdAt leadId',
    )
    .lean();

  const rows = [];
  for (const lead of candidates) {
    if (normalizeStageLabel(lead.status) !== 'Delivered') continue;
    const deliveryDate = deliveryDateOf(lead);
    if (!deliveryDate || Number.isNaN(deliveryDate.getTime())) continue;
    const ms = deliveryDate.getTime();
    if (ms < fromMs || ms > toMs) continue;
    rows.push({ lead, deliveryDate });
  }

  const byExecutiveMap = {};
  const byModelMap = {};
  const bySourceMap = {};
  const byPeriodMap = {};
  const executiveMeta = {};

  for (const { lead, deliveryDate } of rows) {
    const execId = lead.assignedTo?._id ? String(lead.assignedTo._id) : 'unassigned';
    const execName = lead.assignedTo?.name || 'Unassigned';
    bump(byExecutiveMap, execId);
    if (!executiveMeta[execId]) executiveMeta[execId] = { executiveId: execId === 'unassigned' ? null : execId, name: execName };
    bump(byModelMap, lead.model || 'Unknown');
    bump(bySourceMap, lead.source || 'Unknown');
    bump(byPeriodMap, periodBucketKey(deliveryDate, range.period));
  }

  const byExecutive = Object.keys(byExecutiveMap)
    .map((id) => ({
      ...executiveMeta[id],
      count: byExecutiveMap[id],
    }))
    .sort((a, b) => b.count - a.count || (a.name || '').localeCompare(b.name || ''));

  const deliveryRows = rows
    .map(({ lead, deliveryDate }) => ({
      leadId: lead.leadId || String(lead._id),
      _id: String(lead._id),
      name: lead.name,
      mobile: lead.mobile,
      model: lead.model || '—',
      source: lead.source || '—',
      executiveName: lead.assignedTo?.name || 'Unassigned',
      executiveId: lead.assignedTo?._id ? String(lead.assignedTo._id) : null,
      deliveryDate: deliveryDate.toISOString(),
    }))
    .sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));

  return {
    period: range.period,
    from: range.from,
    to: range.to,
    bucketUnit: periodBucketUnit(range.period),
    totalDeliveries: rows.length,
    byExecutive,
    byModel: sortedCountEntries(byModelMap).map(({ key, count }) => ({ model: key, count })),
    bySource: sortedCountEntries(bySourceMap).map(({ key, count }) => ({ source: key, count })),
    byPeriod: Object.entries(byPeriodMap)
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket)),
    rows: deliveryRows.slice(0, 500),
  };
}

module.exports = {
  buildDeliveryReport,
  deliveryDateOf,
};
