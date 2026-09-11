const Lead = require('../models/Lead');
const VehicleOrder = require('../models/VehicleOrder');
const { normalizeStageLabel } = require('../constants/leadStages');
const { resolvePeriodRange, periodBucketKey, periodBucketUnit } = require('./reportPeriod');

function bookingDateOf(lead, order) {
  if (order?.createdAt) return new Date(order.createdAt);
  if (lead?.creSheet?.bookingDate) return new Date(lead.creSheet.bookingDate);
  if (lead?.updatedAt) return new Date(lead.updatedAt);
  if (lead?.createdAt) return new Date(lead.createdAt);
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
 * CRM Booking Report — customer-wise bookings with Name, Model, Variant, Colour.
 * Sources: VehicleOrder linked to leads + leads in Booking stage / creSheet.bookingDone.
 */
async function buildBookingReport({ period, from, to, year, source } = {}) {
  const range = resolvePeriodRange({ period, from, to, year });
  const fromMs = range.fromDate.getTime();
  const toMs = range.toDate.getTime();

  const sourceFilter = source ? String(source).trim() : '';
  const useSource = sourceFilter && sourceFilter.toLowerCase() !== 'all';

  const orders = await VehicleOrder.find({ stage: { $ne: 'CANCELLED' } })
    .populate({
      path: 'leadId',
      select:
        'name mobile model source status assignedTo leadId opportunityId creSheet createdAt updatedAt isDuplicate',
      populate: { path: 'assignedTo', select: 'name email designation' },
    })
    .populate('assignedExecutive', 'name email designation')
    .select(
      'orderNumber bookingNo customerName customerMobile preferredModel preferredVariant preferredColour stage leadId assignedExecutive createdAt updatedAt',
    )
    .lean();

  const leadMatch = {
    isDuplicate: { $ne: true },
    $or: [
      { status: { $in: ['Booking', 'Booked', 'booking', 'booked'] } },
      { 'creSheet.bookingDone': true },
    ],
  };
  if (useSource) leadMatch.source = sourceFilter;

  const bookingLeads = await Lead.find(leadMatch)
    .populate('assignedTo', 'name email designation')
    .select(
      'name mobile model source status assignedTo leadId opportunityId creSheet createdAt updatedAt',
    )
    .lean();

  const coveredLeadIds = new Set();
  const rows = [];

  for (const order of orders) {
    const lead = order.leadId && typeof order.leadId === 'object' ? order.leadId : null;
    if (lead?.isDuplicate) continue;
    if (useSource && lead && lead.source !== sourceFilter) continue;

    const bookingDate = bookingDateOf(lead, order);
    if (!bookingDate || Number.isNaN(bookingDate.getTime())) continue;
    const ms = bookingDate.getTime();
    if (ms < fromMs || ms > toMs) continue;

    if (lead?._id) coveredLeadIds.add(String(lead._id));

    const customerName = order.customerName || lead?.name || '—';
    const carModel =
      order.preferredModel || lead?.creSheet?.finalModel || lead?.model || '—';
    const carVariant =
      order.preferredVariant || lead?.creSheet?.finalVariant || '';
    const colour = order.preferredColour || lead?.creSheet?.finalColour || '';

    rows.push({
      lead,
      order,
      bookingDate,
      customerName,
      carModel,
      carVariant,
      colour,
    });
  }

  for (const lead of bookingLeads) {
    if (coveredLeadIds.has(String(lead._id))) continue;
    const stage = normalizeStageLabel(lead.status);
    if (stage !== 'Booking' && !lead.creSheet?.bookingDone) continue;

    const bookingDate = bookingDateOf(lead, null);
    if (!bookingDate || Number.isNaN(bookingDate.getTime())) continue;
    const ms = bookingDate.getTime();
    if (ms < fromMs || ms > toMs) continue;

    rows.push({
      lead,
      order: null,
      bookingDate,
      customerName: lead.name || '—',
      carModel: lead.creSheet?.finalModel || lead.model || '—',
      carVariant: lead.creSheet?.finalVariant || '',
      colour: lead.creSheet?.finalColour || '',
    });
  }

  const byExecutiveMap = {};
  const byModelMap = {};
  const bySourceMap = {};
  const byPeriodMap = {};
  const executiveMeta = {};

  for (const row of rows) {
    const lead = row.lead;
    const exec =
      row.order?.assignedExecutive && typeof row.order.assignedExecutive === 'object'
        ? row.order.assignedExecutive
        : lead?.assignedTo;
    const execId = exec?._id ? String(exec._id) : 'unassigned';
    const execName = exec?.name || 'Unassigned';
    bump(byExecutiveMap, execId);
    if (!executiveMeta[execId]) {
      executiveMeta[execId] = {
        executiveId: execId === 'unassigned' ? null : execId,
        name: execName,
      };
    }
    bump(byModelMap, row.carModel || 'Unknown');
    bump(bySourceMap, lead?.source || 'Unknown');
    bump(byPeriodMap, periodBucketKey(row.bookingDate, range.period));
  }

  const byExecutive = Object.keys(byExecutiveMap)
    .map((id) => ({
      ...executiveMeta[id],
      count: byExecutiveMap[id],
    }))
    .sort((a, b) => b.count - a.count || (a.name || '').localeCompare(b.name || ''));

  const bookingRows = rows
    .map(({ lead, order, bookingDate, customerName, carModel, carVariant, colour }) => {
      const exec =
        order?.assignedExecutive && typeof order.assignedExecutive === 'object'
          ? order.assignedExecutive
          : lead?.assignedTo;
      return {
        leadId: lead?.leadId || (lead?._id ? String(lead._id) : ''),
        opportunityId: lead?.opportunityId || '',
        orderNumber: order?.orderNumber || '',
        bookingNo: order?.bookingNo || '',
        _id: order?._id ? String(order._id) : lead?._id ? String(lead._id) : '',
        customerName,
        name: customerName,
        mobile: order?.customerMobile || lead?.mobile || '',
        carModel,
        carVariant,
        colour,
        model: carModel,
        variant: carVariant,
        source: lead?.source || '—',
        executiveName: exec?.name || 'Unassigned',
        executiveId: exec?._id ? String(exec._id) : null,
        bookingDate: bookingDate.toISOString(),
        stage: order?.stage || lead?.status || 'Booking',
      };
    })
    .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

  return {
    period: range.period,
    from: range.from,
    to: range.to,
    bucketUnit: periodBucketUnit(range.period),
    totalBookings: rows.length,
    byExecutive,
    byModel: sortedCountEntries(byModelMap).map(({ key, count }) => ({ model: key, count })),
    bySource: sortedCountEntries(bySourceMap).map(({ key, count }) => ({ source: key, count })),
    byPeriod: Object.entries(byPeriodMap)
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket)),
    rows: bookingRows.slice(0, 500),
  };
}

module.exports = {
  buildBookingReport,
  bookingDateOf,
};
