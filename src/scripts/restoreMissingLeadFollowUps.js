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
const fs = require('fs');
const path = require('path');
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

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function leadHasNote(leadId, note) {
  const n = normalizeNote(note);
  if (!n) return true;
  const hit = await LeadFollowUp.findOne({ leadId, note: n }).select('_id').lean();
  if (hit) return true;
  const fuzzy = await LeadFollowUp.findOne({
    leadId,
    $or: [{ note: new RegExp(escapeRe(n.slice(0, 120))) }, { outcome: n }],
  })
    .select('_id')
    .lean();
  return Boolean(fuzzy);
}

async function remarksCoveredByTimeline(leadId, remarks) {
  const n = normalizeNote(remarks);
  if (!n) return true;
  const rows = await LeadFollowUp.find({ leadId }).select('note outcome').lean();
  if (!rows.length) return false;
  const probe = n.slice(0, 60).toLowerCase();
  return rows.some((r) => {
    const blob = `${r.note || ''} ${r.outcome || ''}`.toLowerCase();
    return blob.includes(probe) || probe.includes(blob.slice(0, 60));
  });
}

function skipRemarksText(note) {
  if (!note) return true;
  if (/merged duplicate of/i.test(note)) return true;
  return false;
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

/** Remarks when timeline is completely empty (all executives). */
async function restoreFromLeadRemarks(apply, fallbackActorId, touchedLeadIds, reportRows) {
  const leads = await Lead.find({
    isDuplicate: { $ne: true },
    remarks: { $exists: true, $nin: [null, ''] },
  })
    .select('_id name mobile remarks assignedTo createdAt')
    .populate({ path: 'assignedTo', select: 'name' })
    .lean();

  let restored = 0;
  for (const lead of leads) {
    const count = await LeadFollowUp.countDocuments({ leadId: lead._id });
    if (count > 0) continue;
    const note = normalizeNote(lead.remarks);
    if (note.length < 3 || skipRemarksText(note)) continue;
    if (!apply) {
      restored += 1;
      continue;
    }
    const actor = lead.assignedTo?._id || lead.assignedTo || fallbackActorId;
    const displayNote = note.length < 8 ? note : `[Restored from remarks] ${note}`;
    const ok = await createFollowUp({
      leadId: lead._id,
      createdBy: actor,
      note: displayNote,
      status: 'completed',
      at: lead.createdAt,
      touchedLeadIds,
    });
    if (ok) {
      restored += 1;
      reportRows.push({
        executive: lead.assignedTo?.name || 'Unassigned',
        customer: lead.name,
        mobile: lead.mobile,
        source: 'remarks_empty_timeline',
        message: note.slice(0, 200),
      });
    }
  }
  return restored;
}

/** Remarks saved on lead but not reflected in any follow-up row (any executive). */
async function restoreRemarksNotOnTimeline(apply, fallbackActorId, touchedLeadIds, reportRows) {
  const leads = await Lead.find({
    isDuplicate: { $ne: true },
    remarks: { $exists: true, $nin: [null, ''] },
  })
    .select('_id name mobile remarks assignedTo createdAt')
    .populate({ path: 'assignedTo', select: 'name' })
    .lean();

  let restored = 0;
  for (const lead of leads) {
    const note = normalizeNote(lead.remarks);
    if (note.length < 8 || skipRemarksText(note)) continue;
    if (await leadHasNote(lead._id, note)) continue;
    if (await remarksCoveredByTimeline(lead._id, note)) continue;
    if (!apply) {
      restored += 1;
      continue;
    }
    const actor = lead.assignedTo?._id || lead.assignedTo || fallbackActorId;
    const ok = await createFollowUp({
      leadId: lead._id,
      createdBy: actor,
      note: `[Restored from remarks] ${note}`,
      status: 'completed',
      at: lead.createdAt,
      touchedLeadIds,
    });
    if (ok) {
      restored += 1;
      reportRows.push({
        executive: lead.assignedTo?.name || 'Unassigned',
        customer: lead.name,
        mobile: lead.mobile,
        source: 'remarks_not_on_timeline',
        message: note.slice(0, 200),
      });
    }
  }
  return restored;
}

/** CRE sheet text columns → follow-up rows when missing (import / sheet edits). */
async function restoreFromCreSheetRemarkFields(apply, fallbackActorId, touchedLeadIds, reportRows) {
  const fields = [
    ['initialRemark', 'Initial: '],
    ['salesPersonRemark', 'Sales: '],
    ['afterTdRemark', 'After TD: '],
    ['tdNotDoneWhy', 'TD not done: '],
  ];
  const leads = await Lead.find({ isDuplicate: { $ne: true }, creSheet: { $exists: true } })
    .select('_id name mobile creSheet assignedTo createdAt')
    .populate({ path: 'assignedTo', select: 'name' })
    .lean();

  let restored = 0;
  for (const lead of leads) {
    const cs = lead.creSheet || {};
    for (const [key, prefix] of fields) {
      const raw = normalizeNote(cs[key]);
      if (!raw || raw.length < 3) continue;
      const note = `${prefix}${raw}`;
      if (await leadHasNote(lead._id, note) || await leadHasNote(lead._id, raw)) continue;
      if (!apply) {
        restored += 1;
        continue;
      }
      const actor = lead.assignedTo?._id || lead.assignedTo || fallbackActorId;
      const ok = await createFollowUp({
        leadId: lead._id,
        createdBy: actor,
        note,
        status: 'completed',
        at: cs.callDate || lead.createdAt,
        touchedLeadIds,
      });
      if (ok) {
        restored += 1;
        reportRows.push({
          executive: lead.assignedTo?.name || 'Unassigned',
          customer: lead.name,
          mobile: lead.mobile,
          source: `creSheet.${key}`,
          message: note.slice(0, 200),
        });
      }
    }
  }
  return restored;
}

function writeReportCsv(reportRows, filePath) {
  if (!reportRows.length) return;
  const header = 'assignedExecutive,customerName,mobile,restoreSource,message\n';
  const lines = reportRows.map((r) =>
    [
      `"${String(r.executive).replace(/"/g, '""')}"`,
      `"${String(r.customer || '').replace(/"/g, '""')}"`,
      r.mobile || '',
      r.source,
      `"${String(r.message).replace(/"/g, '""')}"`,
    ].join(','),
  );
  fs.writeFileSync(filePath, header + lines.join('\n'), 'utf8');
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
    const reportRows = [];

    const n = await restoreFromNotifications(apply, fallbackActorId, touchedLeadIds);
    console.log(`Notifications: ${n.restored} restorable (${n.candidates} checked)`);

    const s = await restoreFromLeadSheetLabels(apply, fallbackActorId, touchedLeadIds);
    console.log(`Sheet free-text follow-up: ${s.restored} restorable (${s.candidates} checked)`);

    const creN = await restoreFromCreSheetRemarkFields(apply, fallbackActorId, touchedLeadIds, reportRows);
    console.log(`CRE sheet remark fields: ${creN} restorable`);

    const remarksN = await restoreFromLeadRemarks(apply, fallbackActorId, touchedLeadIds, reportRows);
    console.log(`Lead remarks (empty timeline): ${remarksN} restorable`);

    const remarksGap = await restoreRemarksNotOnTimeline(apply, fallbackActorId, touchedLeadIds, reportRows);
    console.log(`Lead remarks (not on timeline): ${remarksGap} restorable`);

    const moved = await relinkOrphanPrefixedFollowUps(apply);
    console.log(`Orphan prefixed on duplicate leads: ${moved} to relink`);

    const reportPath = path.join(
      process.cwd(),
      process.env.RESTORE_REPORT_CSV || 'follow-up-restore-by-executive.csv',
    );
    if (apply && reportRows.length) {
      writeReportCsv(reportRows, reportPath);
      console.log(`Report: ${reportPath} (${reportRows.length} rows)`);
    }

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
