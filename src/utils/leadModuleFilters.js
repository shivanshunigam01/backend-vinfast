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
  WEBSITE_DIRECT_SOURCES,
  TERMINAL_LOST,
};
