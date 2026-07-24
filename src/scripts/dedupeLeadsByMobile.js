/**
 * Deduplicate CRM leads by mobile (single customer identity).
 * Keeps the oldest lead as primary; merges stage history/follow-ups onto it;
 * soft-closes newer duplicates (status Lost + note) without deleting audit data.
 *
 * Dry-run by default. Apply with APPLY=1.
 *
 *   node src/scripts/dedupeLeadsByMobile.js
 *   APPLY=1 node src/scripts/dedupeLeadsByMobile.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadStageHistory = require('../models/LeadStageHistory');
const TDBooking = require('../models/TDBooking');

function normalizeMobile(m) {
  return String(m || '').replace(/\D/g, '').slice(-10);
}

(async () => {
  const apply = process.env.APPLY === '1';
  try {
    await connectDB();
    const leads = await Lead.find({}).sort({ createdAt: 1 }).lean();
    const byMobile = new Map();

    for (const lead of leads) {
      const mobile = normalizeMobile(lead.mobile);
      if (!/^[6-9]\d{9}$/.test(mobile)) continue;
      if (!byMobile.has(mobile)) byMobile.set(mobile, []);
      byMobile.get(mobile).push(lead);
    }

    let groups = 0;
    let dupes = 0;

    for (const [mobile, group] of byMobile) {
      if (group.length < 2) continue;
      groups += 1;
      const [primary, ...rest] = group;
      console.log(`\nMobile ${mobile}: keep ${primary.leadId || primary._id} (${primary.name}), close ${rest.length} duplicate(s)`);

      for (const d of rest) {
        dupes += 1;
        if (!apply) continue;

        await LeadFollowUp.updateMany({ leadId: d._id }, { $set: { leadId: primary._id } });
        await LeadStageHistory.updateMany({ leadId: d._id }, { $set: { leadId: primary._id } });
        await TDBooking.updateMany({ leadId: d._id }, { $set: { leadId: primary._id } });

        await Lead.findByIdAndUpdate(d._id, {
          $set: {
            status: 'Lost',
            remarks: [d.remarks, `Merged duplicate of ${primary.leadId || primary._id}`]
              .filter(Boolean)
              .join(' · '),
            duplicateOf: primary._id,
            isDuplicate: true,
          },
        });

        await LeadStageHistory.create({
          leadId: primary._id,
          fromStage: primary.status,
          toStage: primary.status,
          reason: `Merged duplicate lead ${d.leadId || d._id} (${d.name})`,
        });
      }
    }

    console.log(`\nFound ${groups} duplicate mobile groups, ${dupes} duplicate leads.`);
    console.log(apply ? 'Applied merges.' : 'Dry-run only. Re-run with APPLY=1 to apply.');
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
