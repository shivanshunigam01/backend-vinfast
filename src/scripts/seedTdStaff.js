/**
 * Seed TD staff users for User Master (full sales hierarchy).
 *
 * Usage on server:
 *   SEED_TD_STAFF_CONFIRM=yes npm run seed:td-staff
 *
 * Default password: SEED_TD_STAFF_PASSWORD env or ChangeMe123!
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');

const DEFAULT_PASSWORD = process.env.SEED_TD_STAFF_PASSWORD || 'ChangeMe123!';

const STAFF_SEED = [
  { name: 'Amit Sharma', email: 'amit.sharma@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Priya Singh', email: 'priya.singh@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Rohan Verma', email: 'rohan.verma@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Vikram Rao', email: 'vikram.rao@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Neha Kapoor', email: 'neha.kapoor@patliputravinfast.com', designation: 'sales_manager' },
  { name: 'Rajesh Kumar', email: 'rajesh.kumar@patliputravinfast.com', designation: 'branch_manager' },
  { name: 'General Manager', email: 'gm@patliputravinfast.com', designation: 'gm' },
  { name: 'Chief Executive', email: 'ceo@patliputravinfast.com', designation: 'ceo' },
  { name: 'Managing Director', email: 'md@patliputravinfast.com', designation: 'md' },
];

function roleForDesignation(designation) {
  return designation === 'sales_executive' || designation === 'cre' ? 'executive' : 'manager';
}

async function importLegacyStaffIfEmpty() {
  const existing = await TDStaff.countDocuments();
  if (existing > 0) return 0;

  const db = mongoose.connection.db;
  const legacyNames = ['tdusers', 'td_users', 'tdstaffs', 'staffusers'];
  let imported = 0;

  for (const collName of legacyNames) {
    let coll;
    try {
      coll = db.collection(collName);
      const n = await coll.countDocuments();
      if (n === 0) continue;
    } catch {
      continue;
    }

    const rows = await coll.find({}).toArray();
    for (const row of rows) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email) continue;
      const designation = row.designation || row.role || 'sales_executive';
      await TDStaff.findOneAndUpdate(
        { email },
        {
          $setOnInsert: {
            name: String(row.name || row.fullName || email.split('@')[0]).trim(),
            email,
            password: DEFAULT_PASSWORD,
            designation,
            role: roleForDesignation(designation),
            active: row.active !== false,
          },
        },
        { upsert: true, new: true },
      );
      imported += 1;
    }
    if (imported > 0) break;
  }

  return imported;
}

(async () => {
  try {
    if (process.env.SEED_TD_STAFF_CONFIRM !== 'yes') {
      console.error('Set SEED_TD_STAFF_CONFIRM=yes to seed TD staff users.');
      process.exit(1);
    }

    await connectDB();

    const legacyImported = await importLegacyStaffIfEmpty();
    if (legacyImported > 0) {
      console.log(`Imported ${legacyImported} user(s) from legacy TD staff collection.`);
      process.exit(0);
    }

    let created = 0;
    let skipped = 0;

    for (const row of STAFF_SEED) {
      const exists = await TDStaff.findOne({ email: row.email });
      if (exists) {
        skipped += 1;
        continue;
      }
      await TDStaff.create({
        name: row.name,
        email: row.email,
        password: DEFAULT_PASSWORD,
        designation: row.designation,
        role: roleForDesignation(row.designation),
        active: true,
      });
      created += 1;
      console.log(`  + ${row.designation}: ${row.name} <${row.email}>`);
    }

    console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
    console.log(`Default password for new users: ${DEFAULT_PASSWORD}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed TD staff:', error.message);
    process.exit(1);
  }
})();
