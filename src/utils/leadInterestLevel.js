const { INTEREST_LEVELS } = require('../models/LeadFollowUp');

function normalizeLeadInterestLevel(raw) {
  const s = String(raw || '').trim().toUpperCase();
  return INTEREST_LEVELS.includes(s) ? s : null;
}

/** Match CRM lead flag on interestLevel and legacy CRE HOT/WARM/COLD columns. */
function interestLevelMatchClause(level) {
  const normalized = normalizeLeadInterestLevel(level);
  if (!normalized) return null;
  const re = new RegExp(`^${normalized}$`, 'i');
  return {
    $or: [
      { interestLevel: normalized },
      { leadType: re },
      { 'creSheet.followUp': re },
    ],
  };
}

function appendInterestLevelFilter(query, rawLevel) {
  const clause = interestLevelMatchClause(rawLevel);
  if (!clause) return query;
  const next = { ...query };
  next.$and = [...(next.$and || []), clause];
  return next;
}

function resolveLeadInterestLevel(lead) {
  const direct = normalizeLeadInterestLevel(lead?.interestLevel);
  if (direct) return direct;
  const fromType = normalizeLeadInterestLevel(lead?.leadType);
  if (fromType) return fromType;
  const fromSheet = normalizeLeadInterestLevel(lead?.creSheet?.followUp);
  if (fromSheet) return fromSheet;
  return null;
}

module.exports = {
  INTEREST_LEVELS,
  normalizeLeadInterestLevel,
  interestLevelMatchClause,
  appendInterestLevelFilter,
  resolveLeadInterestLevel,
};
