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

module.exports = {
  normalizeInterestLevel,
  syncLeadNextFollowUp,
  ensureNextPendingFollowUp,
  stampFirstResponse,
  followUpHighlight,
};
