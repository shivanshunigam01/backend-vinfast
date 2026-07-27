/**
 * Scaffold for legacy CRM data migration (MoM #10).
 * Place JSON exports under ./data/legacy/ and run:
 *   node src/scripts/importLegacyCrmData.js
 *
 * Expected files (optional, skip if missing):
 *   leads.json, opportunities.json, testDrives.json, bookings.json, deliveries.json
 *
 * This script is intentionally conservative: it upserts by mobile + externalId
 * and never deletes existing records.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { intakePvLead } = require('../utils/pvLeadIntake');

const DATA_DIR = path.join(__dirname, '../data/legacy');

function readJson(name) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

(async () => {
  try {
    await connectDB();
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`Created ${DATA_DIR}. Drop JSON exports there, then re-run.`);
      await mongoose.connection.close();
      process.exit(0);
    }

    const leads = readJson('leads.json');
    let imported = 0;
    if (Array.isArray(leads)) {
      for (const row of leads) {
        await intakePvLead({
          name: row.name || row.customerName,
          mobile: row.mobile || row.phone,
          email: row.email,
          city: row.city || 'Unknown',
          model: row.model || 'VF 7',
          source: row.source || 'Legacy Import',
          status: row.status || 'Enquiry',
          remarks: row.remarks || `Legacy import ${row.id || row._id || ''}`.trim(),
          historyReason: 'Legacy CRM import',
        });
        imported += 1;
      }
      console.log(`Imported/updated ${imported} leads from leads.json`);
    } else {
      console.log('No leads.json found — skipped leads.');
    }

    console.log('Done. Add more JSON files (testDrives.json, bookings.json) as exports become available.');
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
