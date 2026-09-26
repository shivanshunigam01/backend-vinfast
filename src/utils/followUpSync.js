const LeadFollowUp = require('../models/LeadFollowUp');
const { INTEREST_LEVELS } = require('../models/LeadFollowUp');

function normalizeInterestLevel(raw) {
  const s = String(raw || '').trim().toUpperCase();
  return INTEREST_LEVELS.includes(s) ? s : undefined;
}

async function syncLeadNextFollowUp(lead) {
  if (!lead?._id) return lead;
  const next = await LeadFollowUp.findOne({
    leadId: lead._id,
    status: 'pending',
    scheduledAt: { $ne: null },
  })
    .sort({ scheduledAt: 1 })
    .select('scheduledAt')
    .lean();

  lead.nextFollowUp = next?.scheduledAt || undefined;
  if (!lead.nextFollowUp) {
    lead.nextFollowUp = undefined;
  }
  return lead;
}

/** Create the next pending follow-up if a future date was captured on complete. */
async function ensureNextPendingFollowUp(lead, { createdBy, nextAt, nextAction } = {}) {
  if (!lead?._id || !nextAt) return null;
  const when = new Date(nextAt);
  if (Number.isNaN(when.getTime()) || when <= new Date()) return null;
  const existing = await LeadFollowUp.findOne({
    leadId: lead._id,
    status: 'pending',
    scheduledAt: when,
  }).lean();
  if (existing) return existing;
  return LeadFollowUp.create({
    leadId: lead._id,
    createdBy,
    note: nextAction ? String(nextAction).trim() : 'Scheduled follow-up',
    scheduledAt: when,
    nextAction: nextAction ? String(nextAction).trim() : undefined,
    status: 'pending',
  });
}

function stampFirstResponse(lead, at = new Date()) {
  if (!lead) return;
  if (!lead.firstRespondedAt) lead.firstRespondedAt = at;
}

function followUpHighlight(nextFollowUp, now = new Date()) {
  if (!nextFollowUp) return 'none';
  const d = new Date(nextFollowUp);
  if (Number.isNaN(d.getTime())) return 'none';
  if (d < now) return 'overdue';
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (d >= start && d <= end) return 'today';
  return 'future';
}

function followUpEffectiveDate(fu) {
  if (!fu) return null;
  const raw = fu.completedAt || fu.scheduledAt || fu.createdAt;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function stripStructuredFollowUpPrefix(note) {
  return String(note || '')
    .replace(/^(CRE|Sales)\s#\d+:\s*/i, '')
    .trim();
}

/** Most recent follow-up by call date (completed → scheduled → logged). */
function pickLatestFollowUp(followUps = []) {
  if (!Array.isArray(followUps) || !followUps.length) return null;
  return [...followUps].sort((a, b) => {
    const ta = followUpEffectiveDate(a)?.getTime() ?? 0;
    const tb = followUpEffectiveDate(b)?.getTime() ?? 0;
    if (tb !== ta) return tb - ta;
    const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cb - ca;
  })[0];
}

function displayLabelFromFollowUp(fu) {
  if (!fu) return undefined;
  const outcome = String(fu.outcome || '').trim();
  if (outcome) return outcome;
  const note = stripStructuredFollowUpPrefix(fu.note);
  return note || undefined;
}

/**
 * Keep Excel FOLLOW-UP / leadType aligned with the latest follow-up (not the first import).
 */
async function refreshLeadFollowUpDisplayFields(lead, { followUps: preloaded } = {}) {
  if (!lead?._id) return { latest: null, changed: false };
  const rows =
    preloaded ||
    (await LeadFollowUp.find({ leadId: lead._id })
      .select('note outcome scheduledAt completedAt createdAt status')
      .lean());
  const latest = pickLatestFollowUp(rows);
  const label = displayLabelFromFollowUp(latest);
  if (!label) return { latest, changed: false };

  const prev = String(lead.leadType || lead.creSheet?.followUp || '').trim();
  if (prev === label) return { latest, changed: false };

  lead.leadType = label;
  lead.creSheet = lead.creSheet || {};
  lead.creSheet.followUp = label;
  await lead.save();
  return { latest, changed: true };
}

module.exports = {
  normalizeInterestLevel,
  syncLeadNextFollowUp,
  ensureNextPendingFollowUp,
  stampFirstResponse,
  followUpHighlight,
  followUpEffectiveDate,
  pickLatestFollowUp,
  displayLabelFromFollowUp,
  refreshLeadFollowUpDisplayFields,
};
