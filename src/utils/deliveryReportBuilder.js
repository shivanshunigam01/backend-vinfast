const Lead = require('../models/Lead');
const { normalizeStageLabel } = require('../constants/leadStages');
const {
  loadPipelineReportContext,
  applySourceFilter,
  aggregateAttributedRows,
  appendDeliveryDateFilter,
  effectiveDeliveryDate,
  carModelOf,
  periodBucketUnit,
} = require('./pipelineReportCommon');
const { resolveAttributionStaff } = require('./sheetConsultantStaffMatch');

/**
 * Delivery report — Delivered leads in CRM scope, dated by CRE delivery/retail date
 * (same rules as leadDateFilter delivery clause).
 */
async function buildDeliveryReport({ admin, period, from, to, year, source } = {}) {
  const ctx = await loadPipelineReportContext({ admin, period, from, to, year, source });
  const { range, leadScope, useSource, sourceFilter, staffRows, alignedCounts } = ctx;

  const query = {
    ...leadScope,
    isDuplicate: { $ne: true },
    status: { $in: ['Delivered', 'delivered'] },
  };
  applySourceFilter(query, useSource, sourceFilter);
  appendDeliveryDateFilter(query, { from: range.from, to: range.to });

  const leads = await Lead.find(query)
    .populate('assignedTo', 'name email designation')
    .select(
      'name mobile model source status assignedTo assignedToEmail convertedAt creSheet createdAt updatedAt leadId',
    )
    .lean();

  const eventRows = [];
  for (const lead of leads) {
    if (normalizeStageLabel(lead.status) !== 'Delivered') continue;
    const deliveryDate = effectiveDeliveryDate(lead);
    if (!deliveryDate || Number.isNaN(deliveryDate.getTime())) continue;
    eventRows.push({
      lead,
      eventDate: deliveryDate,
      periodKey: range.period,
      carModel: carModelOf(lead),
    });
  }

  const agg = aggregateAttributedRows(eventRows, staffRows);

  const deliveryRows = eventRows
    .map(({ lead, eventDate }) => {
      const staff = resolveAttributionStaff(lead, staffRows);
      const execRow = agg.byExecutive.find(
        (e) => e.executiveId === (staff?._id ? String(staff._id) : null),
      );
      return {
        leadId: lead.leadId || String(lead._id),
        _id: String(lead._id),
        name: lead.name,
        mobile: lead.mobile,
        model: lead.model || '—',
        carModel: carModelOf(lead),
        carVariant: lead.creSheet?.finalVariant || '',
        colour: lead.creSheet?.finalColour || '',
        source: lead.source || '—',
        executiveName: staff?.name || 'Unassigned',
        executiveId: staff?._id ? String(staff._id) : null,
        sheetConsultant: String(lead.creSheet?.salesConsultantName || '').trim() || '—',
        teamManager: execRow?.teamManagerName || '—',
        deliveryDate: eventDate.toISOString(),
        status: 'Delivered',
      };
    })
    .sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));

  return {
    period: range.period,
    from: range.from,
    to: range.to,
    bucketUnit: periodBucketUnit(range.period),
    totalDeliveries: eventRows.length,
    alignedWithLeadReport: {
      ...alignedCounts.deliveries,
      periodLabel: alignedCounts.leadReportPeriodLabel,
      note:
        'All / MTD / Today match Lead CRM Reports KPI tiles (enquiry date + Delivered stage). ' +
        'Total in selected range uses CRE delivery/retail date.',
    },
    totalInSelectedRange: eventRows.length,
    byExecutive: agg.byExecutive,
    byTeam: agg.byTeam,
    byModel: agg.byModel,
    bySource: agg.bySource,
    byPeriod: agg.byPeriod,
    breakdownTotals: agg.breakdownTotals,
    rows: deliveryRows.slice(0, 5000),
    rowsTotal: deliveryRows.length,
    rowsTruncated: deliveryRows.length > 5000,
  };
}

module.exports = {
  buildDeliveryReport,
  deliveryDateOf: effectiveDeliveryDate,
};
