const { INTEREST_LEVELS } = require('../models/LeadFollowUp');

function normalizeLeadInterestLevel(raw) {
  const s = String(raw || '').trim().toUpperCase();
  return INTEREST_LEVELS.includes(s) ? s : null;
}

/** Mongo $expr — same priority as resolveLeadInterestLevel (one bucket per lead). */
function resolvedInterestLevelExpr() {
  const upperTrim = (field) => ({
    $toUpper: { $trim: { input: { $ifNull: [field, ''] } } },
  });
  return {
    $let: {
      vars: {
        direct: upperTrim('$interestLevel'),
        fromType: upperTrim('$leadType'),
        fromSheet: upperTrim('$creSheet.followUp'),
      },
      in: {
        $cond: [
          { $in: ['$$direct', INTEREST_LEVELS] },
          '$$direct',
          {
            $cond: [
              { $in: ['$$fromType', INTEREST_LEVELS] },
              '$$fromType',
              {
                $cond: [
                  { $in: ['$$fromSheet', INTEREST_LEVELS] },
                  '$$fromSheet',
                  null,
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

/** Match resolved HOT/WARM/COLD — avoids double-counting across legacy columns. */
function interestLevelMatchClause(level) {
  const normalized = normalizeLeadInterestLevel(level);
  if (!normalized) return null;
  return { $expr: { $eq: [resolvedInterestLevelExpr(), normalized] } };
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
  resolvedInterestLevelExpr,
  interestLevelMatchClause,
  appendInterestLevelFilter,
  resolveLeadInterestLevel,
};
