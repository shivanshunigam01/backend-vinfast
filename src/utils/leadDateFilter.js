const { dateKeyRange, toDateKey } = require('./reportPeriod');

/** Effective lead date for counts/reports — matches CRM default (enquiry date, then createdAt). */
function leadEffectiveDate(lead) {
  const enquiry = lead?.creSheet?.enquiryDate;
  if (enquiry) {
    const d = new Date(enquiry);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (lead?.createdAt) {
    const d = new Date(lead.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function buildLeadEnquiryDateClause(from, to) {
  if (!from && !to) return null;
  const range = dateKeyRange(from, to);
  return {
    $or: [
      { 'creSheet.enquiryDate': range },
      { 'creSheet.enquiryDate': { $exists: false }, createdAt: range },
      { 'creSheet.enquiryDate': null, createdAt: range },
    ],
  };
}

/** Append date filter to a lead query (same semantics as CRM `buildLeadQuery`). */
function appendLeadDateFilter(query, { from, to, dateField = 'enquiry' } = {}) {
  if (!from && !to) return query;
  const range = dateKeyRange(from, to);
  if (dateField === 'activity') {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { lastActivityAt: range },
        { lastActivityAt: { $exists: false }, updatedAt: range },
        { lastActivityAt: null, updatedAt: range },
      ],
    });
  } else if (dateField === 'enquiry') {
    const clause = buildLeadEnquiryDateClause(from, to);
    if (clause) {
      query.$and = query.$and || [];
      query.$and.push(clause);
    }
  } else {
    query.createdAt = range;
  }
  return query;
}

/** Mongo filter: leads received in range (enquiry date, else createdAt). */
function leadEnquiryReceivedFilter(from, to) {
  const clause = buildLeadEnquiryDateClause(from, to);
  return clause || {};
}

function subtractCalendarDaysKey(fromDate, days) {
  const x = new Date(fromDate);
  x.setDate(x.getDate() - days);
  return toDateKey(x);
}

/**
 * Enquiry-age buckets for Detailed Report (days since enquiry / createdAt).
 * Hot ≤30d, Warm 31–60d, Cold >60d.
 */
function leadEnquiryTemperatureFilter(temperature, now = new Date()) {
  const t = String(temperature || '').trim().toLowerCase();
  const todayKey = toDateKey(now);
  if (t === 'hot') {
    return leadEnquiryReceivedFilter(subtractCalendarDaysKey(now, 30), todayKey);
  }
  if (t === 'warm') {
    return leadEnquiryReceivedFilter(subtractCalendarDaysKey(now, 60), subtractCalendarDaysKey(now, 31));
  }
  if (t === 'cold') {
    return leadEnquiryReceivedFilter(null, subtractCalendarDaysKey(now, 61));
  }
  return {};
}

module.exports = {
  leadEffectiveDate,
  buildLeadEnquiryDateClause,
  appendLeadDateFilter,
  leadEnquiryReceivedFilter,
  leadEnquiryTemperatureFilter,
};
