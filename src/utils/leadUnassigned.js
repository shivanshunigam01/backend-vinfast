/** Matches Excel / MIS: blank or "Un-assigned" sales consultant on imported sheet. */
const UNASSIGNED_CONSULTANT_RX = /^un-assigned$/i;

function normalizeConsultantName(value) {
  return String(value ?? '').trim();
}

function isUnassignedConsultantName(value) {
  const name = normalizeConsultantName(value);
  return !name || UNASSIGNED_CONSULTANT_RX.test(name);
}

/**
 * Mongo match: lead has no CRM owner or sheet consultant is blank / Un-assigned.
 */
function leadUnassignedMongoFilter() {
  return {
    $or: [
      { assignedTo: { $exists: false } },
      { assignedTo: null },
      { 'creSheet.salesConsultantName': { $exists: false } },
      { 'creSheet.salesConsultantName': null },
      { 'creSheet.salesConsultantName': '' },
      { 'creSheet.salesConsultantName': { $regex: /^un-assigned$/i } },
    ],
  };
}

/** Inverse of {@link leadUnassignedMongoFilter} — has owner + sheet consultant set. */
function leadAssignedMongoFilter() {
  return { $nor: [leadUnassignedMongoFilter()] };
}

/** $expr for aggregations: true when sheet consultant is assigned (non-blank, not Un-assigned). */
function sheetConsultantAssignedExpr() {
  const trimmed = { $trim: { input: { $ifNull: ['$creSheet.salesConsultantName', ''] } } };
  return {
    $and: [
      { $gt: [{ $strLenCP: trimmed }, 0] },
      {
        $not: {
          $regexMatch: {
            input: trimmed,
            regex: /^un-assigned$/i,
          },
        },
      },
    ],
  };
}

module.exports = {
  UNASSIGNED_CONSULTANT_RX,
  normalizeConsultantName,
  isUnassignedConsultantName,
  leadUnassignedMongoFilter,
  leadAssignedMongoFilter,
  sheetConsultantAssignedExpr,
};
