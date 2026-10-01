/**
 * Detailed Report "Lead Type" — canonical CRE categories only (not follow-up remarks).
 */

const CANONICAL_LABEL = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD',
  LOST: 'LOST',
  'FOLLOW-UP': 'FOLLOW-UP',
  'FOLLOW UP': 'FOLLOW-UP',
  FOLLOWUP: 'FOLLOW-UP',
  'NOT CONNECTED': 'NOT CONNECTED',
  'NOT CONNECT': 'NOT CONNECTED',
  'BOOKING DONE': 'Booking Done',
  'CLOSED WON': 'Closed Won',
  ENQUIRY: 'Enquiry',
  INTERESTED: 'Interested',
  'NOT INTERESTED': 'Not Interested',
};

/** Free-text / remark patterns that must not appear as lead types in MIS. */
const REMARK_RX =
  /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|customer said|whatsapp|brochure|quotation|call not|not respond|not picked|out of station|send the|will decide|test drive|price list|id proof|urgent work/i;

/**
 * Map raw lead.leadType / sheet FOLLOW-UP cell → report bucket, or null to exclude.
 */
function normalizeLeadTypeForDetailedReport(raw) {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return null;

  if (t.length > 48) return null;
  if (t.split(/\s+/).length > 5) return null;
  if (REMARK_RX.test(t)) return null;

  const upper = t.toUpperCase();
  if (CANONICAL_LABEL[upper]) return CANONICAL_LABEL[upper];

  if (/^hot$/i.test(t)) return 'HOT';
  if (/^warm$/i.test(t)) return 'WARM';
  if (/^cold$/i.test(t)) return 'COLD';
  if (/^lost$/i.test(t)) return 'LOST';
  if (/^follow[\s-]*up$/i.test(t)) return 'FOLLOW-UP';
  if (/^not\s+connect(ed)?$/i.test(t)) return 'NOT CONNECTED';
  if (/^booking\s+done$/i.test(t)) return 'Booking Done';
  if (/^closed\s+won$/i.test(t)) return 'Closed Won';
  if (/^enquiry$/i.test(t)) return 'Enquiry';
  if (/^interested$/i.test(t)) return 'Interested';
  if (/^not\s+interested$/i.test(t)) return 'Not Interested';

  return null;
}

/** Roll up Mongo leadType $group rows into canonical report rows. */
function bucketLeadTypeAggRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const label = normalizeLeadTypeForDetailedReport(row._id);
    if (!label) continue;
    map.set(label, (map.get(label) || 0) + (row.count || 0));
  }
  return [...map.entries()]
    .map(([leadType, count]) => ({ leadType, count }))
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  normalizeLeadTypeForDetailedReport,
  bucketLeadTypeAggRows,
};
