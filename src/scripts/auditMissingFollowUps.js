/**
 * List customers where a staff notification references a follow-up note
 * that is not present on the lead's LeadFollowUp timeline (likely deleted).
 *
 *   node src/scripts/auditMissingFollowUps.js
 *   node src/scripts/auditMissingFollowUps.js --csv missing-follow-ups.csv
 */
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const StaffNotification = require('../models/StaffNotification');
require('../models/TDStaff');

const FOLLOW_UP_NOTIFY_TYPES = ['follow_up_completed', 'follow_up_due', 'follow_up_rescheduled'];
const LEAD_POPULATE = { path: 'assignedTo', select: 'name email' };

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function noteExistsOnLead(leadId, note) {
  const n = String(note || '').trim();
  if (!n) return true;
  const exact = await LeadFollowUp.findOne({ leadId, note: n }).select('_id').lean();
  if (exact) return true;
  const partial = await LeadFollowUp.findOne({
    leadId,
    $or: [{ note: new RegExp(escapeRe(n.slice(0, 80))) }, { outcome: n }],
  })
    .select('_id')
    .lean();
  return Boolean(partial);
}

(async () => {
  const csvPath = process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : null;
  try {
    await connectDB();

    const notifs = await StaffNotification.find({
      type: { $in: FOLLOW_UP_NOTIFY_TYPES },
      leadId: { $exists: true, $ne: null },
      body: { $exists: true, $ne: '' },
    })
      .sort({ createdAt: -1 })
      .lean();

    const missing = [];
    const seen = new Set();

    for (const row of notifs) {
      const exists = await noteExistsOnLead(row.leadId, row.body);
      if (exists) continue;
      const key = `${row.leadId}|${row.body}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const lead = await Lead.findById(row.leadId).populate(LEAD_POPULATE).lean();
      if (!lead) continue;

      missing.push({
        customerName: row.customerName || lead.name || '—',
        mobile: lead.mobile || '—',
        leadId: String(lead.leadId || lead._id),
        assignedExecutive: lead.assignedTo?.name || 'Unassigned',
        assignedEmail: lead.assignedTo?.email || '',
        deletedOrMissingMessage: String(row.body).trim(),
        notificationType: row.type,
        loggedAt: row.createdAt,
      });
    }

    const restoredAll = await LeadFollowUp.find({ note: /^\[Restored from remarks\]/ })
      .populate({ path: 'leadId', select: 'name mobile leadId assignedTo', populate: LEAD_POPULATE })
      .sort({ createdAt: -1 })
      .lean();

    const restoredRows = [];
    for (const fu of restoredAll) {
      const lead = fu.leadId;
      if (!lead || typeof lead !== 'object') continue;
      const raw = String(fu.note).replace(/^\[Restored from remarks\]\s*/, '').trim();
      restoredRows.push({
        customerName: lead.name || '—',
        mobile: lead.mobile || '—',
        leadId: String(lead.leadId || lead._id),
        assignedExecutive: lead.assignedTo?.name || 'Unassigned',
        assignedEmail: lead.assignedTo?.email || '',
        restoredMessage: raw,
        restoredAt: fu.createdAt,
      });
    }

    console.log('\n=== Follow-ups in notifications but NOT on timeline (likely deleted) ===\n');
    if (!missing.length) {
      console.log('None found — every notification body still matches a follow-up row.\n');
    } else {
      for (const r of missing) {
        console.log(
          [
            r.customerName,
            r.mobile,
            `Executive: ${r.assignedExecutive}`,
            `Lead: ${r.leadId}`,
            `Missing: ${r.deletedOrMissingMessage.slice(0, 120)}`,
            `Notif: ${r.notificationType} @ ${r.loggedAt}`,
          ].join(' | '),
        );
      }
      console.log(`\nTotal: ${missing.length} customer/message pair(s)\n`);
    }

    console.log('=== Recently restored from remarks (timeline was empty) ===\n');
    console.log(`Count: ${restoredRows.length} (showing up to 500)\n`);
    for (const r of restoredRows.slice(0, 30)) {
      console.log(
        `${r.customerName} | ${r.mobile} | Executive: ${r.assignedExecutive} | ${r.restoredMessage.slice(0, 100)}`,
      );
    }
    if (restoredRows.length > 30) console.log(`… and ${restoredRows.length - 30} more`);

    const restoredCsv = csvPath ? csvPath.replace(/\.csv$/i, '-restored.csv') : 'restored-from-remarks.csv';
    if (restoredRows.length) {
      const h =
        'customerName,mobile,assignedExecutive,assignedEmail,leadId,messagePreviouslyMissingFromTimeline,restoredAt\n';
      const lines = restoredRows.map((r) =>
        [
          `"${String(r.customerName).replace(/"/g, '""')}"`,
          r.mobile,
          `"${String(r.assignedExecutive).replace(/"/g, '""')}"`,
          r.assignedEmail,
          r.leadId,
          `"${String(r.restoredMessage).replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          r.restoredAt ? new Date(r.restoredAt).toISOString() : '',
        ].join(','),
      );
      fs.writeFileSync(restoredCsv, h + lines.join('\n'), 'utf8');
      console.log(`\nWrote ${restoredCsv} (${restoredRows.length} rows)`);
    }

    if (csvPath && missing.length) {
      const header = 'customerName,mobile,assignedExecutive,assignedEmail,leadId,missingMessage,notificationType,loggedAt\n';
      const lines = missing.map((r) =>
        [
          r.customerName,
          r.mobile,
          r.assignedExecutive,
          r.assignedEmail,
          r.leadId,
          `"${r.deletedOrMissingMessage.replace(/"/g, '""')}"`,
          r.notificationType,
          r.loggedAt ? new Date(r.loggedAt).toISOString() : '',
        ].join(','),
      );
      fs.writeFileSync(csvPath, header + lines.join('\n'), 'utf8');
      console.log(`Wrote ${csvPath}`);
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
