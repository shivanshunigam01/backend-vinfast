/**
 * Seed CRE (Customer Relationship Executive) staff users.
 *
 * Usage:
 *   npm run seed:cre
 *   SEED_CRE_PASSWORD='YourPass123' npm run seed:cre
 *
 * Idempotent: creates cre1 / cre2 if missing; updates designation/role/modules on re-run.
 * Password is only set on first insert (or when SEED_CRE_RESET_PASSWORD=yes).
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');

const DEFAULT_PASSWORD = process.env.SEED_CRE_PASSWORD || 'Cre@12345';
const RESET_PASSWORD = process.env.SEED_CRE_RESET_PASSWORD === 'yes';

/** CRE portal: own dashboard + full Lead CRM. */
const CRE_MODULES = ['my_dashboard', 'crm_leads'];
const CRE_ACTIONS = [
  'my_dashboard:view',
  'crm_leads:view',
  'crm_leads:create',
  'crm_leads:update',
  'crm_leads:delete',
  'crm_leads:assign',
  'crm_leads:export',
];

const CRE_SEED = [
  {
    name: 'CRE 1',
    email: 'cre1@patliputravinfast.com',
    designation: 'cre',
    password: process.env.SEED_CRE1_PASSWORD || DEFAULT_PASSWORD,
  },
  {
    name: 'CRE 2',
    email: 'cre2@patliputravinfast.com',
    designation: 'cre',
    password: process.env.SEED_CRE2_PASSWORD || DEFAULT_PASSWORD,
  },
];

(async () => {
  try {
    await connectDB();

    let created = 0;
    let updated = 0;
    const credentials = [];

    for (const row of CRE_SEED) {
      const email = row.email.trim().toLowerCase();
      const existing = await TDStaff.findOne({ email }).select('+password');

      if (existing) {
        existing.name = row.name;
        existing.designation = 'cre';
        existing.role = 'executive';
        existing.active = true;
        existing.allowedModules = CRE_MODULES;
        existing.allowedActions = CRE_ACTIONS;
        if (RESET_PASSWORD) {
          existing.password = row.password;
        }
        await existing.save();
        updated += 1;
        credentials.push({
          name: row.name,
          email,
          password: RESET_PASSWORD ? row.password : '(unchanged — set SEED_CRE_RESET_PASSWORD=yes to reset)',
          id: String(existing._id),
        });
        console.log(`  ~ updated CRE: ${row.name} <${email}> id=${existing._id}`);
        continue;
      }

      const doc = await TDStaff.create({
        name: row.name,
        email,
        password: row.password,
        designation: 'cre',
        role: 'executive',
        active: true,
        allowedModules: CRE_MODULES,
        allowedActions: CRE_ACTIONS,
      });
      created += 1;
      credentials.push({
        name: row.name,
        email,
        password: row.password,
        id: String(doc._id),
      });
      console.log(`  + created CRE: ${row.name} <${email}> id=${doc._id}`);
    }

    console.log(`\nDone. Created ${created}, updated ${updated}.`);
    console.log('\nCRE login credentials (portal: /staff/login → My Dashboard + Lead CRM):');
    for (const c of credentials) {
      console.log(`  ${c.name}`);
      console.log(`    id:       ${c.id}`);
      console.log(`    email:    ${c.email}`);
      console.log(`    password: ${c.password}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to seed CRE users:', error.message);
    process.exit(1);
  }
})();
