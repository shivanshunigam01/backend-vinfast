/**
 * Lead visibility rules per module:
 * - crm: TD not done (pipeline leads)
 * - td: TD done = Yes (active — not Lost / Not Interested)
 * - booking: Booking stage or bookingDone (active — not Lost / Not Interested)
 */

const TERMINAL_LOST = ['Lost', 'Not Interested'];

/** Public website / test-drive forms (no staff createdBy on intake). */
const WEBSITE_DIRECT_SOURCES = [
  'Test Drive',
  'Website',
  'Website Enquiry',
  'Enquiry',
  'Book Now',
  'Pre-Booking',
  'Patliputra Vinfast Website',
  'Brochure download',
];

function websiteDirectLeadMongoFilter() {
  return {
    $and: [
      {
        $or: [
          { source: { $in: WEBSITE_DIRECT_SOURCES } },
          { source: { $regex: /website/i } },
          { testDriveId: { $exists: true, $ne: null } },
          { tdBookingId: { $exists: true, $ne: null } },
          { enquiryId: { $exists: true, $ne: null } },
          { pageSource: { $exists: true, $nin: [null, ''] } },
        ],
      },
      {
        $or: [{ createdBy: { $exists: false } }, { createdBy: null }],
      },
    ],
  };
}

function hasWebsiteDirectSignals(plain) {
  if (!plain || typeof plain !== 'object') return false;
  const src = String(plain.source || '').trim();
  if (WEBSITE_DIRECT_SOURCES.includes(src)) return true;
  if (/website/i.test(src)) return true;
  if (plain.testDriveId) return true;
  if (plain.tdBookingId) return true;
  if (plain.enquiryId) return true;
  const pageSource = String(plain.pageSource || '').trim();
  if (pageSource) return true;
  return false;
}

/** In-memory: customer website / test-drive intake (no staff createdBy). */
function isWebsiteDirectLead(plain) {
  if (!plain || typeof plain !== 'object') return false;
  const createdBy = plain.createdBy?._id || plain.createdBy;
  if (createdBy) return false;
  return hasWebsiteDirectSignals(plain);
}

/** Matches Booking CRM module list + booking KPI counts. */
function crmBookingModuleMatch() {
  return {
    status: { $nin: TERMINAL_LOST },
    $or: [
      { status: { $in: ['Booking', 'Booked', 'Delivered'] } },
      { 'creSheet.bookingDone': true },
    ],
  };
}

/** Matches TD CRM module list + TD-done lead counts (sheet flag). */
function crmTdModuleMatch() {
  return {
    status: { $nin: TERMINAL_LOST },
    'creSheet.tdDone': true,
  };
}

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
    query.$and.push(crmTdModuleMatch());
  } else if (view === 'booking') {
    query.$and.push(crmBookingModuleMatch());
  }

  return query;
}

module.exports = {
  applyLeadModuleViewFilter,
  crmBookingModuleMatch,
  crmTdModuleMatch,
  websiteDirectLeadMongoFilter,
  isWebsiteDirectLead,
  WEBSITE_DIRECT_SOURCES,
  TERMINAL_LOST,
};
