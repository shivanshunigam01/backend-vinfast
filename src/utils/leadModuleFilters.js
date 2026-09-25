/**
 * Lead visibility rules per module:
 * - crm: TD not done (pipeline leads)
 * - td: TD done = Yes
 * - booking: Booking done = Yes
 */

function applyLeadModuleViewFilter(query, moduleView) {
  const view = String(moduleView || '').trim().toLowerCase();
  if (!view || view === 'all') return query;

  query.$and = query.$and || [];

  if (view === 'crm') {
    query.$and.push({
      $or: [
        { 'creSheet.tdDone': { $ne: true } },
        { 'creSheet.tdDone': { $exists: false } },
        { 'creSheet.tdDone': null },
      ],
    });
  } else if (view === 'td') {
    query.$and.push({ 'creSheet.tdDone': true });
  } else if (view === 'booking') {
    query.$and.push({ 'creSheet.bookingDone': true });
  }

  return query;
}

module.exports = { applyLeadModuleViewFilter };
