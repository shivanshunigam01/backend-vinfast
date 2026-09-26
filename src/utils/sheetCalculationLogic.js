/**
 * Metrics aligned with Calculation Logic.docx / $$All Lead Data.xlsx dashboard.
 */

const DIGITAL_LEAD_SOURCES = [
  'CarDekho',
  'Meta Ads',
  'Patliputra Vinfast Website',
  'Social Media',
  'Vinfast Digital',
  'Website Enquiry',
  'WhatsApp',
  'Google Ads',
  'Facebook',
  'Instagram',
  'Zentroverse',
];

const DIGITAL_LEAD_SOURCES_LOWER = new Set(DIGITAL_LEAD_SOURCES.map((s) => s.toLowerCase()));

/** Walk-in total in the sheet — LEAD SOURCE = "Walk-In" only (not Tele-In, Outdoor, etc.). */
function isSheetWalkInSource(source) {
  return String(source || '').trim().toUpperCase() === 'WALK-IN';
}

function isSheetDigitalSource(source) {
  return DIGITAL_LEAD_SOURCES_LOWER.has(String(source || '').trim().toLowerCase());
}

function sheetWalkInQuery() {
  return {
    source: { $regex: /^walk[\s-]?in$/i },
  };
}

function sheetDigitalQuery() {
  return {
    source: {
      $in: DIGITAL_LEAD_SOURCES,
    },
  };
}

/** Test Drive Till Date — non-empty TD Date (column P). */
function sheetTdTillDateQuery() {
  return {
    'creSheet.tdDate': { $exists: true, $ne: null },
  };
}

/** TD done with a date — column P not empty and column Q = Yes. */
function sheetTdDoneQuery() {
  return {
    'creSheet.tdDone': true,
    ...sheetTdTillDateQuery(),
  };
}

function sheetBookingCountQuery() {
  return { 'creSheet.bookingDone': true };
}

function sheetTdMonthRange(from, to) {
  return {
    $or: [
      { 'creSheet.tdDate': { $gte: from, $lte: to } },
      {
        'creSheet.tdDate': { $exists: false },
        'creSheet.monthYearTd': { $gte: from, $lte: to },
      },
    ],
  };
}

module.exports = {
  DIGITAL_LEAD_SOURCES,
  isSheetWalkInSource,
  isSheetDigitalSource,
  sheetWalkInQuery,
  sheetDigitalQuery,
  sheetTdTillDateQuery,
  sheetTdDoneQuery,
  sheetBookingCountQuery,
  sheetTdMonthRange,
};
