/**
 * Disposable Sales Executive + sample leads for testing User Master delete → lead transfer (SM/SH).
 *
 * Safe to re-run: upserts the test user and re-assigns the same test leads.
 *
 * Usage (production or local — needs MONGO_URI in .env):
 *   SEED_TRANSFER_TEST_CONFIRM=yes npm run seed:transfer-test-user
 *
 * Optional:
 *   TRANSFER_TEST_MANAGER_EMAIL=rajan.singh@patliputravinfast.com
 *   SEED_TD_TEAM_PASSWORD=YourPass123
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const TDStaff = require('../models/TDStaff');
const { nextLeadId } = require('../utils/pvIdGenerator');

const TEST_SE = {
  name: 'Transfer Test SE',
  email: 'transfer.test.se@patliputravinfast.com',
  designation: 'sales_executive',
  role: 'executive',
};

const DEFAULT_PASSWORD = process.env.SEED_TD_TEAM_PASSWORD || 'Patliputra@123';
const MANAGER_EMAIL = (
  process.env.TRANSFER_TEST_MANAGER_EMAIL || 'rajan.singh@patliputravinfast.com'
).trim().toLowerCase();

const TEST_LEADS = [
  {
    marker: 'TRANSFER-TEST-1',
    name: 'Transfer Test Customer One',
    mobile: '9999900001',
    city: 'Patna',
    model: 'VF 6',
    source: 'Walk-in',
  },
  {
    marker: 'TRANSFER-TEST-2',
    name: 'Transfer Test Customer Two',
    mobile: '9999900002',
    city: 'Patna',
    model: 'VF 7',
    source: 'Meta Ads',
  },
];

async function upsertTestLead(se, spec) {
  let lead = await Lead.findOne({ mobile: spec.mobile, isDuplicate: { $ne: true } });
  if (!lead) {
    lead = await Lead.create({
      leadId: await nextLeadId(),
      name: spec.name,
      mobile: spec.mobile,
      city: spec.city,
      model: spec.model,
      source: spec.source,
      status: 'New',
      remarks: `${spec.marker} — safe to delete after transfer test`,
    });
  } else {
    lead.name = spec.name;
    lead.remarks = `${spec.marker} — safe to delete after transfer test`;
  }
  lead.assignedTo = se._id;
  lead.assignedToEmail = se.email;
  lead.creSheet = lead.creSheet || {};
  lead.creSheet.salesConsultantName = `${se.name} (SE)`;
  lead.lastActivityAt = new Date();
  await lead.save();
  return lead;
}

(async () => {
  if (process.env.SEED_TRANSFER_TEST_CONFIRM !== 'yes') {
    console.error('Set SEED_TRANSFER_TEST_CONFIRM=yes to create the transfer test user.');
    process.exit(1);
  }

  await connectDB();

  const manager = await TDStaff.findOne({ email: MANAGER_EMAIL, active: { $ne: false } });
  if (!manager) {
    throw new Error(
      `Sales manager not found: ${MANAGER_EMAIL}. Run npm run seed:td-team or set TRANSFER_TEST_MANAGER_EMAIL.`,
    );
  }

  let se = await TDStaff.findOne({ email: TEST_SE.email });
  if (se) {
    se.name = TEST_SE.name;
    se.designation = TEST_SE.designation;
    se.role = TEST_SE.role;
    se.reportsTo = manager._id;
    se.active = true;
    if (!se.password) se.password = DEFAULT_PASSWORD;
    await se.save();
    console.log('Updated test SE:', se.email);
  } else {
    se = await TDStaff.create({
      ...TEST_SE,
      password: DEFAULT_PASSWORD,
      reportsTo: manager._id,
      active: true,
    });
    console.log('Created test SE:', se.email);
  }

  const salesHead = await TDStaff.findOne({ designation: 'sales_head', active: { $ne: false } })
    .select('name email')
    .lean();

  const leads = [];
  for (const spec of TEST_LEADS) {
    const lead = await upsertTestLead(se, spec);
    leads.push({ leadId: lead.leadId, name: lead.name, mobile: lead.mobile });
  }

  console.log('\n--- Transfer test setup (feature #3) ---');
  console.log('Login (staff): /staff/login');
  console.log('  Email:   ', TEST_SE.email);
  console.log('  Password:', DEFAULT_PASSWORD, '(or SEED_TD_TEAM_PASSWORD if you set it)');
  console.log('\nReports to SM:', manager.name, `<${manager.email}>`);
  if (salesHead) {
    console.log('Sales Head in org:', salesHead.name, `<${salesHead.email}>`);
  }
  console.log('\nAssigned test leads:');
  console.table(leads);
  console.log('\nUser Master → delete "' + TEST_SE.name + '" → choose Transfer to SM or SH.');
  console.log('Staff _id:', String(se._id));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
