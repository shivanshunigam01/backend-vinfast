/**
 * Seed Stock module roles (StaffRole) + operational users (TDStaff) per spec Sheet 11.
 *
 * Usage:
 *   npm run seed:stock-module
 *   SEED_STOCK_PASSWORD='YourPass123' npm run seed:stock-module
 *   SEED_STOCK_RESET_PASSWORD=yes npm run seed:stock-module
 *
 * Also grants GM user (gm@patliputravinfast.com) the GM / Dealer Head stock role if present.
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const StaffRole = require('../models/StaffRole');
const TDStaff = require('../models/TDStaff');
const { STOCK_ROLE_TEMPLATES, STOCK_USER_SEED } = require('../constants/stockRolePermissions');

const DEFAULT_PASSWORD = process.env.SEED_STOCK_PASSWORD || 'Stock@12345';
const RESET_PASSWORD = process.env.SEED_STOCK_RESET_PASSWORD === 'yes';

async function upsertRole(template) {
  const doc = await StaffRole.findOneAndUpdate(
    { name: template.name },
    {
      name: template.name,
      description: template.description,
      authRole: template.authRole,
      allowedModules: template.allowedModules,
      allowedActions: template.allowedActions,
      active: true,
    },
    { upsert: true, new: true },
  );
  return doc;
}

async function upsertUser({ name, email, roleName, designation, mobile, password }) {
  const role = await StaffRole.findOne({ name: roleName });
  if (!role) throw new Error(`Role not found: ${roleName}`);

  const normEmail = email.trim().toLowerCase();
  const existing = await TDStaff.findOne({ email: normEmail }).select('+password');
  const authRole = role.authRole === 'manager' ? 'manager' : 'executive';

  if (existing) {
    existing.name = name;
    existing.designation = designation;
    existing.role = authRole;
    existing.staffRoleId = role._id;
    existing.allowedModules = role.allowedModules;
    existing.allowedActions = role.allowedActions;
    existing.active = true;
    if (mobile) existing.mobile = mobile;
    if (RESET_PASSWORD) existing.password = password;
    await existing.save();
    return { doc: existing, created: false, password: RESET_PASSWORD ? password : '(unchanged)' };
  }

  const doc = await TDStaff.create({
    name,
    email: normEmail,
    password,
    designation,
    role: authRole,
    mobile: mobile || undefined,
    staffRoleId: role._id,
    allowedModules: role.allowedModules,
    allowedActions: role.allowedActions,
    active: true,
  });
  return { doc, created: true, password };
}

async function mergeRoleOntoStaff(staff, role) {
  if (!staff || !role) return false;
  const mergedModules = [...new Set([...(staff.allowedModules || []), ...role.allowedModules])];
  const mergedActions = [...new Set([...(staff.allowedActions || []), ...role.allowedActions])];
  staff.allowedModules = mergedModules;
  staff.allowedActions = mergedActions;
  if (!staff.staffRoleId) staff.staffRoleId = role._id;
  await staff.save();
  return true;
}

(async () => {
  try {
    await connectDB();
    const { ensureDefaultVendors } = require('../controllers/vendorController');
    await ensureDefaultVendors();
    console.log('  ✓ Default vendors (VinFast)');

    console.log('Creating / updating Stock module roles…');
    const roleMap = {};
    for (const template of STOCK_ROLE_TEMPLATES) {
      const role = await upsertRole(template);
      roleMap[template.name] = role;
      console.log(`  ✓ Role: ${template.name}`);
    }

    console.log('\nCreating / updating Stock module users…');
    let created = 0;
    let updated = 0;
    const credentials = [];

    for (const row of STOCK_USER_SEED) {
      const result = await upsertUser({ ...row, password: DEFAULT_PASSWORD });
      result.created ? created++ : updated++;
      credentials.push({
        name: row.name,
        email: row.email,
        role: row.roleName,
        password: result.password,
      });
      console.log(`  ${result.created ? '+' : '~'} ${row.name} <${row.email}> → ${row.roleName}`);
    }

    const gm = await TDStaff.findOne({ email: 'gm@patliputravinfast.com' });
    const gmRole = roleMap['GM / Dealer Head'];
    if (gm && gmRole) {
      await mergeRoleOntoStaff(gm, gmRole);
      console.log(`\n  ~ Merged GM / Dealer Head stock permissions onto ${gm.email}`);
    }

    // Wire stock permissions onto existing sales org (from seed:td-team)
    const salesManagerRole = roleMap['Sales Manager'];
    const salesExecutiveRole = roleMap['Sales Executive'];
    let salesManagersMerged = 0;
    let salesExecutivesMerged = 0;

    if (salesManagerRole) {
      const managerDesignations = ['sales_manager', 'sales_head', 'branch_manager'];
      const managers = await TDStaff.find({
        active: { $ne: false },
        designation: { $in: managerDesignations },
      });
      for (const staff of managers) {
        await mergeRoleOntoStaff(staff, salesManagerRole);
        salesManagersMerged += 1;
        console.log(`  ~ Sales Manager stock access → ${staff.name} <${staff.email}>`);
      }
    }

    if (salesExecutiveRole) {
      const executives = await TDStaff.find({
        active: { $ne: false },
        designation: 'sales_executive',
      });
      for (const staff of executives) {
        await mergeRoleOntoStaff(staff, salesExecutiveRole);
        salesExecutivesMerged += 1;
        console.log(`  ~ Sales Executive stock access → ${staff.name} <${staff.email}>`);
      }
    }

    // Leadership (GM / MD / CEO / Sales Head) get PO approval + stock visibility
    const leadershipRole = roleMap['GM / Dealer Head'];
    if (leadershipRole) {
      const leaders = await TDStaff.find({
        active: { $ne: false },
        designation: { $in: ['md', 'ceo', 'gm', 'sales_head'] },
      });
      for (const staff of leaders) {
        await mergeRoleOntoStaff(staff, leadershipRole);
        console.log(`  ~ GM stock / PO approve → ${staff.name} <${staff.email}>`);
      }
    }

    console.log(`\nDone. Users created ${created}, updated ${updated}.`);
    console.log(`Sales team wired: ${salesManagersMerged} manager(s), ${salesExecutivesMerged} executive(s).`);
    console.log('\nStock module login credentials (/staff/login or /admin/login):');
    for (const c of credentials) {
      console.log(`  [${c.role}]`);
      console.log(`    email:    ${c.email}`);
      console.log(`    password: ${c.password}`);
    }
    console.log(`\nDefault password for new users: ${DEFAULT_PASSWORD}`);
    console.log('Super Admin: use existing admin account (full access).');

    process.exit(0);
  } catch (error) {
    console.error('Failed to seed stock module:', error.message);
    process.exit(1);
  }
})();
