const Lead = require('../models/Lead');
const { normalizeStageLabel } = require('../constants/leadStages');
const { resolveAttributionStaff } = require('./sheetConsultantStaffMatch');
const {
  loadPipelineReportContext,
  applySourceFilter,
  aggregateAttributedRows,
  appendBookingDateFilter,
  crmBookingModuleMatch,
  effectiveBookingDate,
  carModelOf,
  periodBucketUnit,
} = require('./pipelineReportCommon');

/**
 * CRM Booking Report — same lead scope & booking module rules as Lead/Detailed reports.
 * Period filter: CRE booking date (or booking-stage updatedAt fallback).
 */
async function buildBookingReport({ admin, period, from, to, year, source } = {}) {
  const ctx = await loadPipelineReportContext({ admin, period, from, to, year, source });
  const { range, leadScope, useSource, sourceFilter, staffRows, alignedCounts } = ctx;

  const query = {
    ...leadScope,
    isDuplicate: { $ne: true },
    ...crmBookingModuleMatch(),
  };
  applySourceFilter(query, useSource, sourceFilter);
  appendBookingDateFilter(query, { from: range.from, to: range.to });

  const leads = await Lead.find(query)
    .populate('assignedTo', 'name email designation')
    .select(
      'name mobile model source status assignedTo assignedToEmail leadId opportunityId creSheet createdAt updatedAt',
    )
    .lean();

  const eventRows = [];
  for (const lead of leads) {
    const st = normalizeStageLabel(lead.status);
    if (!['Booking', 'Booked', 'Delivered'].includes(st) && !lead.creSheet?.bookingDone) continue;

    const bookingDate = effectiveBookingDate(lead);
    if (!bookingDate || Number.isNaN(bookingDate.getTime())) continue;

    eventRows.push({
      lead,
      eventDate: bookingDate,
      periodKey: range.period,
      carModel: carModelOf(lead),
    });
  }

  const agg = aggregateAttributedRows(eventRows, staffRows);

  const bookingRows = eventRows
    .map(({ lead, eventDate }) => {
      const staff = resolveAttributionStaff(lead, staffRows);
      const execMeta = agg.byExecutive.find(
        (e) => e.executiveId === (staff?._id ? String(staff._id) : null),
      );
      return {
        leadId: lead.leadId || String(lead._id),
        opportunityId: lead.opportunityId || '',
        orderNumber: '',
        bookingNo: lead.creSheet?.bookingNo || '',
        _id: String(lead._id),
        customerName: lead.name || '—',
        name: lead.name || '—',
        mobile: lead.mobile || '',
        carModel: carModelOf(lead),
        carVariant: lead.creSheet?.finalVariant || '',
        colour: lead.creSheet?.finalColour || '',
        model: carModelOf(lead),
        variant: lead.creSheet?.finalVariant || '',
        source: lead.source || '—',
        executiveName: staff?.name || 'Unassigned',
        executiveId: staff?._id ? String(staff._id) : null,
        sheetConsultant: String(lead.creSheet?.salesConsultantName || '').trim() || '—',
        teamManager: execMeta?.teamManagerName || '—',
        bookingDate: eventDate.toISOString(),
        stage: normalizeStageLabel(lead.status),
        status: normalizeStageLabel(lead.status),
      };
    })
    .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

  return {
    period: range.period,
    from: range.from,
    to: range.to,
    bucketUnit: periodBucketUnit(range.period),
    totalBookings: eventRows.length,
    alignedWithLeadReport: {
      ...alignedCounts.bookings,
      periodLabel: alignedCounts.leadReportPeriodLabel,
      note:
        'All / MTD / Today match Lead CRM Reports KPI tiles (enquiry date + pipeline stage). ' +
        'Total in selected range uses CRE booking date.',
    },
    totalInSelectedRange: eventRows.length,
    byExecutive: agg.byExecutive,
    byTeam: agg.byTeam,
    byModel: agg.byModel,
    bySource: agg.bySource,
    byPeriod: agg.byPeriod,
    breakdownTotals: agg.breakdownTotals,
    rows: bookingRows.slice(0, 5000),
    rowsTotal: bookingRows.length,
    rowsTruncated: bookingRows.length > 5000,
  };
}

module.exports = {
  buildBookingReport,
  bookingDateOf: effectiveBookingDate,
};
