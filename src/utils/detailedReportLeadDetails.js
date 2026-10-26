const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDBooking = require('../models/TDBooking');
const { normalizeStageLabel } = require('../constants/leadStages');
const { leadEffectiveDate } = require('./leadDateFilter');
const { isSheetWalkInSource, isSheetDigitalSource } = require('./sheetCalculationLogic');
const { toDateKey } = require('./reportPeriod');

const MAX_LEAD_ROWS = 5000;
const MAX_TD_ROWS = 3000;
const MAX_CALL_ROWS = 2000;

function leadInEnquiryRange(lead, from, to) {
  const d = leadEffectiveDate(lead);
  if (!d) return false;
  const key = toDateKey(d);
  const fromKey = from ? toDateKey(from) : null;
  const toKey = to ? toDateKey(to) : null;
  if (fromKey && key < fromKey) return false;
  if (toKey && key > toKey) return false;
  return true;
}

function serializeLeadRow(lead) {
  const src = lead.source || '—';
  return {
    leadId: String(lead._id),
    name: lead.name || '—',
    mobile: lead.mobile || '—',
    model: lead.model || '—',
    status: normalizeStageLabel(lead.status),
    source: src,
    assignedTo: lead.assignedTo?.name || 'Unassigned',
    enquiryAt: leadEffectiveDate(lead)?.toISOString() || lead.createdAt?.toISOString?.() || null,
    remarks: lead.remarks || '—',
    isWalkInSheet: isSheetWalkInSource(src),
    isDigitalSheet: isSheetDigitalSource(src),
    bookingDone: Boolean(lead.creSheet?.bookingDone),
  };
}

async function buildDetailedReportLeadDetails({
  leadScope,
  scopedLeadIds,
  mtdStart,
  mtdMonthEnd,
  todayStart,
  todayEnd,
  yearStart,
  activeTdBookingFilter,
}) {
  const [leadDocs, tdDocs, callDocs] = await Promise.all([
    Lead.find(leadScope)
      .select(
        'name mobile model status source assignedTo assignedToEmail creSheet remarks nextFollowUp createdAt',
      )
      .populate({ path: 'assignedTo', select: 'name' })
      .lean(),
    TDBooking.find({
      ...activeTdBookingFilter,
      slotDate: { $gte: yearStart, $lte: todayEnd },
    })
      .select('slotDate bookingStatus customerName customerMobile leadId preferredModel')
      .populate({ path: 'leadId', select: 'model source name mobile' })
      .sort({ slotDate: -1 })
      .limit(MAX_TD_ROWS)
      .lean(),
    scopedLeadIds.length
      ? LeadFollowUp.find({
          leadId: { $in: scopedLeadIds },
          $or: [
            { completedAt: { $gte: todayStart, $lte: todayEnd } },
            { scheduledAt: { $gte: todayStart, $lte: todayEnd }, status: 'pending' },
          ],
        })
          .populate('leadId', 'name mobile model')
          .populate('createdBy', 'name')
          .sort({ completedAt: -1, scheduledAt: -1, createdAt: -1 })
          .limit(MAX_CALL_ROWS)
          .lean()
      : Promise.resolve([]),
  ]);

  const leadDetailRows = leadDocs.slice(0, MAX_LEAD_ROWS).map(serializeLeadRow);

  const testDriveDetailRows = tdDocs.map((b) => {
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

  const followUpCallRows = callDocs.map((f) => {
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
    leadDetailRows,
    leadDetailRowsTotal: leadDocs.length,
    leadDetailRowsTruncated: leadDocs.length > MAX_LEAD_ROWS,
    testDriveDetailRows,
    followUpCallRows,
    periodBounds: {
      mtdFrom: mtdStart.toISOString(),
      mtdTo: mtdMonthEnd.toISOString(),
      todayFrom: todayStart.toISOString(),
      todayTo: todayEnd.toISOString(),
    },
  };
}

module.exports = {
  buildDetailedReportLeadDetails,
  serializeLeadRow,
  leadInEnquiryRange,
};
