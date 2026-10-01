/** Matches Excel / MIS: blank or "Un-assigned" sales consultant on imported sheet. */
const UNASSIGNED_CONSULTANT_RX = /^un-assigned$/i;

function normalizeConsultantName(value) {
  return String(value ?? '').trim();
}

function isUnassignedConsultantName(value) {
  const name = normalizeConsultantName(value);
  return !name || UNASSIGNED_CONSULTANT_RX.test(name);
}

/** CRE sheet SALES CONSULTANT blank or explicit Un-assigned. */
function sheetConsultantUnassignedMongoFilter() {
  return {
    $or: [
      { 'creSheet.salesConsultantName': { $exists: false } },
      { 'creSheet.salesConsultantName': null },
      { 'creSheet.salesConsultantName': '' },
      { 'creSheet.salesConsultantName': { $regex: /^un-assigned$/i } },
    ],
  };
}

/** CRE sheet has a named sales consultant (import / MIS). */
function sheetConsultantAssignedMongoFilter() {
  return {
    $and: [
      { 'creSheet.salesConsultantName': { $exists: true, $nin: [null, ''] } },
      { 'creSheet.salesConsultantName': { $not: { $regex: /^un-assigned$/i } } },
    ],
  };
}

/**
 * Mongo match: genuinely unassigned — no CRM owner and no named sheet consultant.
 * (Leads with only a sheet name are excluded until reconciled onto assignedTo.)
 */
function leadUnassignedMongoFilter() {
  return {
    $and: [
      { $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] },
      {
        $or: [
          { assignedToEmail: { $exists: false } },
          { assignedToEmail: null },
          { assignedToEmail: '' },
        ],
      },
      sheetConsultantUnassignedMongoFilter(),
    ],
  };
}

/** Has a CRM owner or a named sheet sales consultant. */
function leadAssignedMongoFilter() {
  return {
    $or: [
      { assignedTo: { $exists: true, $ne: null } },
      { assignedToEmail: { $exists: true, $nin: [null, ''] } },
      sheetConsultantAssignedMongoFilter(),
    ],
  };
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
  sheetConsultantUnassignedMongoFilter,
  sheetConsultantAssignedMongoFilter,
  sheetConsultantAssignedExpr,
};
