/**
 * Diagnose why an account cannot sign in.
 *
 * Usage on server:
 *   node src/scripts/checkLogin.js jaya@patliputravinfast.com
 *   node src/scripts/checkLogin.js jaya@patliputravinfast.com 'TheirPassword123'
 *
 * Reports which portal the email belongs to, whether it is active, and (when a
 * password is supplied) whether the stored hash actually matches it.
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');
const Admin = require('../models/Admin');

const PORTALS = [
  { label: 'Admin portal  (/admin/login)', Model: Admin, plainField: null },
  { label: 'Staff portal  (/staff/login)', Model: TDStaff, plainField: 'passwordPlain' },
];

(async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const password = process.argv[3];

  if (!email) {
    console.error('Usage: node src/scripts/checkLogin.js <email> [password]');
    process.exit(1);
  }

  try {
    await connectDB();
    let found = 0;

    for (const { label, Model, plainField } of PORTALS) {
      const select = plainField ? `+password +${plainField}` : '+password';
      const doc = await Model.findOne({ email }).select(select);
      if (!doc) continue;

      found += 1;
      console.log(`\n${label}`);
      console.log(`  name        : ${doc.name || '(none)'}`);
      console.log(`  role        : ${doc.role || '(none)'}`);
      console.log(`  active      : ${doc.active === false ? 'NO — login blocked' : 'yes'}`);
      console.log(`  hash stored : ${doc.password ? 'yes' : 'NO — user can never log in'}`);
      if (plainField) {
        console.log(`  saved plain : ${doc[plainField] ? doc[plainField] : '(not recorded)'}`);
      }

      if (password) {
        const ok = doc.password
          ? await doc.comparePassword(password).catch(() => false)
          : false;
        console.log(`  password    : ${ok ? 'MATCHES' : 'does NOT match'}`);
      }
    }

    if (found === 0) {
      console.log(`\nNo Admin or Staff account exists with email "${email}".`);
    } else if (found === 1) {
      console.log('\nSign in from the portal listed above — the other portal will reject it.');
    } else {
      console.log('\nThis email exists on both portals; each has its own password.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error.message);
    process.exit(1);
  }
})();
