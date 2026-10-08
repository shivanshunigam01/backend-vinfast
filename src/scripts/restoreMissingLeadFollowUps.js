/**
 * Re-create LeadFollowUp rows that were removed by accidental CRE-sheet sync
 * (empty remark slots) or never duplicated from lead sheet text.
 *
 * Sources (in order):
 * 1) StaffNotification bodies for follow-up events (UI-logged calls)
 * 2) lead.creSheet.followUp / leadType when no follow-up contains that text
 * 3) Prefixed CRE/Sales slot notes rebuilt from remaining LeadFollowUp on same mobile
 *    (merged leads) — skipped here; use dedupe script if needed
 *
 * Dry-run by default. Apply with APPLY=1.
 *
 *   node src/scripts/restoreMissingLeadFollowUps.js
 *   APPLY=1 node src/scripts/restoreMissingLeadFollowUps.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const StaffNotification = require('../models/StaffNotification');
const TDStaff = require('../models/TDStaff');
const { FOLLOW_UP_SLOT_DEFS } = require('../utils/crmCreSheetSync');
const { syncLeadNextFollowUp, refreshLeadFollowUpDisplayFields } = require('../utils/followUpSync');
const { normalizeLeadTypeForDetailedReport } = require('../utils/leadTypeReport');

const FOLLOW_UP_NOTIFY_TYPES = ['follow_up_completed', 'follow_up_due', 'follow_up_rescheduled'];

function normalizeNote(s) {
  return String(s || '').trim();
}

async function resolveFallbackActorId() {
  const admin = await TDStaff.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: 1 })
    .select('_id')
    .lean();
  return admin?._id;
}

async function leadHasNote(leadId, note) {
  const n = normalizeNote(note);
  if (!n) return true;
  const hit = await LeadFollowUp.findOne({ leadId, note: n }).select('_id').lean();
  if (hit) return true;
  const fuzzy = await LeadFollowUp.findOne({
    leadId,
    $or: [{ note: new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }, { outcome: n }],
  })
    .select('_id')
    .lean();
  return Boolean(fuzzy);
}

async function createFollowUp({ leadId, createdBy, note, status, at, outcome, touchedLeadIds }) {
  const text = normalizeNote(note);
  if (!text) return false;
  const when = at ? new Date(at) : new Date();
  const completed = status === 'completed';
  await LeadFollowUp.create({
    leadId,
    createdBy,
    note: text,
    outcome: outcome ? normalizeNote(outcome) : undefined,
    scheduledAt: when,
    completedAt: completed ? when : undefined,
    status: completed ? 'completed' : 'pending',
    createdAt: when,
    updatedAt: when,
  });
  if (touchedLeadIds) touchedLeadIds.add(String(leadId));
  return true;
}

async function restoreFromNotifications(apply, fallbackActorId, touchedLeadIds) {
  const rows = await StaffNotification.find({
    type: { $in: FOLLOW_UP_NOTIFY_TYPES },
    leadId: { $exists: true, $ne: null },
    body: { $exists: true, $ne: '' },
  })
    .sort({ createdAt: 1 })
    .lean();

  let candidates = 0;
  let restored = 0;

  for (const row of rows) {
    const note = normalizeNote(row.body);
    if (!note) continue;
    candidates += 1;
    const exists = await leadHasNote(row.leadId, note);
    if (exists) continue;
    if (!apply) {
      console.log(`[dry-run] notification → lead ${row.leadId}: ${note.slice(0, 80)}`);
      restored += 1;
      continue;
    }
    const actor = row.actorId || fallbackActorId;
    if (!actor) {
      console.warn(`Skip notification ${row._id}: no actor`);
      continue;
    }
    const ok = await createFollowUp({
      leadId: row.leadId,
      createdBy: actor,
      note,
      status: row.type === 'follow_up_completed' ? 'completed' : 'pending',
      at: row.createdAt,
      touchedLeadIds,
    });
    if (ok) restored += 1;
  }

  return { candidates, restored };
}

function isFreeTextFollowUpRemark(label) {
  const t = normalizeNote(label);
  if (!t) return false;
  // Skip HOT / LOST / FOLLOW-UP buckets — those are status labels, not call notes.
  if (normalizeLeadTypeForDetailedReport(t)) return false;
  return t.length >= 8;
}

async function restoreFromLeadSheetLabels(apply, fallbackActorId, touchedLeadIds) {
  const leads = await Lead.find({
    $or: [
      { 'creSheet.followUp': { $exists: true, $nin: [null, ''] } },
      { leadType: { $exists: true, $nin: [null, ''] } },
    ],
  })
    .select('_id creSheet leadType assignedTo createdAt remarks')
    .lean();

  let candidates = 0;
  let restored = 0;

  for (const lead of leads) {
    const label = normalizeNote(lead.creSheet?.followUp || lead.leadType);
    if (!isFreeTextFollowUpRemark(label)) continue;
    const has = await leadHasNote(lead._id, label);
    if (has) continue;
    candidates += 1;
    if (!apply) {
      console.log(`[dry-run] sheet label → lead ${lead._id}: ${label.slice(0, 80)}`);
      restored += 1;
      continue;
    }
    const actor = lead.assignedTo || fallbackActorId;
    if (!actor) continue;
    const ok = await createFollowUp({
      leadId: lead._id,
      createdBy: actor,
      note: label,
      status: 'completed',
      at: lead.creSheet?.callDate || lead.createdAt,
      touchedLeadIds,
    });
    if (ok) restored += 1;
  }

  return { candidates, restored };
}

/** One-off note from lead.remarks when timeline is empty (accidental wipe). */
async function restoreFromLeadRemarks(apply, fallbackActorId, touchedLeadIds) {
  const leads = await Lead.find({ remarks: { $exists: true, $nin: [null, ''] } })
    .select('_id remarks assignedTo createdAt')
    .lean();

  let restored = 0;
  for (const lead of leads) {
    const count = await LeadFollowUp.countDocuments({ leadId: lead._id });
    if (count > 0) continue;
    const note = normalizeNote(lead.remarks);
    if (note.length < 8) continue;
    if (/^excel model:/i.test(note)) continue;
    if (/merged duplicate of/i.test(note)) continue;
    if (!apply) {
      console.log(`[dry-run] remarks → lead ${lead._id}: ${note.slice(0, 80)}`);
      restored += 1;
      continue;
    }
    const actor = lead.assignedTo || fallbackActorId;
    const ok = await createFollowUp({
      leadId: lead._id,
      createdBy: actor,
      note: `[Restored from remarks] ${note}`,
      status: 'completed',
      at: lead.createdAt,
      touchedLeadIds,
    });
    if (ok) restored += 1;
  }
  return restored;
}

/** Re-link orphaned prefixed notes from duplicate leads (same mobile). */
async function relinkOrphanPrefixedFollowUps(apply) {
  const prefixes = FOLLOW_UP_SLOT_DEFS.flatMap((d) => [d.crePrefix, d.salesPrefix]);
  const regex = new RegExp(`^(${prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);

  const dupes = await Lead.find({ isDuplicate: true, duplicateOf: { $exists: true, $ne: null } })
    .select('_id duplicateOf')
    .lean();
  let moved = 0;
  for (const d of dupes) {
    const rows = await LeadFollowUp.find({ leadId: d._id, note: regex }).lean();
    for (const fu of rows) {
      const onPrimary = await LeadFollowUp.findOne({
        leadId: d.duplicateOf,
        note: fu.note,
      })
        .select('_id')
        .lean();
      if (onPrimary) continue;
      moved += 1;
      if (!apply) {
        console.log(`[dry-run] move follow-up ${fu._id} → primary ${d.duplicateOf}`);
        continue;
      }
      await LeadFollowUp.updateOne({ _id: fu._id }, { $set: { leadId: d.duplicateOf } });
    }
  }
  return moved;
}

async function refreshAffectedLeads(leadIds) {
  for (const id of leadIds) {
    const lead = await Lead.findById(id);
    if (!lead) continue;
    await syncLeadNextFollowUp(lead);
    await refreshLeadFollowUpDisplayFields(lead);
    await lead.save();
  }
}

(async () => {
  const apply = process.env.APPLY === '1';
  try {
    await connectDB();
    const fallbackActorId = await resolveFallbackActorId();
    if (!fallbackActorId) {
      console.error('No TDStaff user found for createdBy fallback.');
      process.exit(1);
    }

    console.log(apply ? 'APPLY=1 — writing to database\n' : 'Dry-run — no writes (use APPLY=1 to apply)\n');

    const touchedLeadIds = new Set();

    const n = await restoreFromNotifications(apply, fallbackActorId, touchedLeadIds);
    console.log(`Notifications: ${n.restored} restorable (${n.candidates} checked)`);

    const s = await restoreFromLeadSheetLabels(apply, fallbackActorId, touchedLeadIds);
    console.log(`Sheet free-text follow-up: ${s.restored} restorable (${s.candidates} checked)`);

    const remarksN = await restoreFromLeadRemarks(apply, fallbackActorId, touchedLeadIds);
    console.log(`From lead remarks (empty timeline): ${remarksN} restorable`);

    const moved = await relinkOrphanPrefixedFollowUps(apply);
    console.log(`Orphan prefixed on duplicate leads: ${moved} to relink`);

    if (apply && touchedLeadIds.size) {
      await refreshAffectedLeads([...touchedLeadIds]);
      console.log(`Refreshed next follow-up on ${touchedLeadIds.size} lead(s).`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try {
      await mongoose.connection.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
})();
