/**
 * Seed the real Patliputra VinFast sales team into TD staff / User Master,
 * preserving the reporting hierarchy (Sales Head → Sales Manager → Sales Executive)
 * so leads and test drives can be assigned to the correct people.
 *
 * Idempotent: re-running updates names / designations / reporting links for existing
 * emails and only sets the default password on first insert (never overwrites a
 * password that already exists).
 *
 * Usage:
 *   npm run seed:td-team
 *   SEED_TD_TEAM_PASSWORD='YourPass123' npm run seed:td-team
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');

const DEFAULT_PASSWORD = process.env.SEED_TD_TEAM_PASSWORD || 'Patliputra@123';

// Top of the chain.
const SALES_HEAD = {
  name: 'Pranay Ranjan',
  email: 'pranay.ranjan@patliputravinfast.com',
  designation: 'sales_head',
};

// Sales Manager → the Sales Executive(s) reporting to them.
const TEAM = [
  {
    manager: { name: 'Rajan Singh', email: 'rajan.singh@patliputravinfast.com' },
    executives: [{ name: 'Pranay Singh', email: 'pranay.singh@patliputravinfast.com' }],
  },
  {
    manager: { name: 'Saurav', email: 'saurav@patliputravinfast.com' },
    executives: [{ name: 'Prashant', email: 'prashant@patliputravinfast.com' }],
  },
  {
    manager: { name: 'Rahul Singh', email: 'rahul.singh@patliputravinfast.com' },
    executives: [{ name: 'Abhishek', email: 'abhishek@patliputravinfast.com' }],
  },
  {
    manager: { name: 'Dilip Choudhary', email: 'dilip.choudhary@patliputravinfast.com' },
    executives: [{ name: 'Sonu', email: 'sonu@patliputravinfast.com' }],
  },
  {
    manager: { name: 'Rahul Kumar', email: 'rahul.kumar@patliputravinfast.com' },
    executives: [
      { name: 'Mayank', email: 'mayank@patliputravinfast.com' },
      { name: 'Jaya', email: 'jaya@patliputravinfast.com' },
    ],
  },
];

function roleForDesignation(designation) {
  return designation === 'sales_executive' ? 'executive' : 'manager';
}

/**
 * Upsert a staff member without clobbering an existing password.
 * Uses .save()/.create() so the bcrypt pre-save hook runs on insert.
 */
async function upsertStaff({ name, email, designation, reportsTo = null }) {
  const normEmail = String(email).trim().toLowerCase();
  const role = roleForDesignation(designation);
  const existing = await TDStaff.findOne({ email: normEmail });

  if (existing) {
    existing.name = String(name).trim();
    existing.designation = designation;
    existing.role = role;
    existing.reportsTo = reportsTo;
    existing.active = true;
    await existing.save();
    return { doc: existing, created: false };
  }

  const doc = await TDStaff.create({
    name: String(name).trim(),
    email: normEmail,
    password: DEFAULT_PASSWORD,
    designation,
    role,
    reportsTo,
    active: true,
  });
  return { doc, created: true };
}

(async () => {
  try {
    await connectDB();

    let created = 0;
    let updated = 0;
    const summary = [];

    const head = await upsertStaff({ ...SALES_HEAD, reportsTo: null });
    head.created ? created++ : updated++;
    summary.push(`SH  ${head.doc.name} <${head.doc.email}>`);

    for (const group of TEAM) {
      const mgr = await upsertStaff({
        name: group.manager.name,
        email: group.manager.email,
        designation: 'sales_manager',
        reportsTo: head.doc._id,
      });
      mgr.created ? created++ : updated++;
      summary.push(`  SM  ${mgr.doc.name} <${mgr.doc.email}>  → reports to ${head.doc.name}`);

      for (const se of group.executives) {
        const exec = await upsertStaff({
          name: se.name,
          email: se.email,
          designation: 'sales_executive',
          reportsTo: mgr.doc._id,
        });
        exec.created ? created++ : updated++;
        summary.push(`    SE  ${exec.doc.name} <${exec.doc.email}>  → reports to ${mgr.doc.name}`);
      }
    }

    console.log('\nSales team hierarchy:\n');
    console.log(summary.join('\n'));
    console.log(`\nDone. Created ${created}, updated ${updated}.`);
    console.log(`Default password for newly created users: ${DEFAULT_PASSWORD}`);
    console.log('Existing users keep their current password (not overwritten).');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed TD team:', error.message);
    try {
      await mongoose.connection.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
})();
