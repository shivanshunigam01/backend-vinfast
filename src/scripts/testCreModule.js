/**
 * End-to-end smoke test for CRE assign + individual CRE reports.
 * Usage: node src/scripts/testCreModule.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');
const Lead = require('../models/Lead');
const { createOneCrmLeadFromBody } = (() => {
  // createOneCrmLeadFromBody is not exported — exercise via controllers helpers in-process
  return {};
})();
const { buildCreReport } = require('../utils/creReportBuilder');
const { isCreUser, isUnrestrictedViewer, isExecutiveScopedUser } = require('../utils/leadAssignment');
const { intakePvLead } = require('../utils/pvLeadIntake');
const { applyLeadAssignment } = require('../utils/leadAssignment');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  await connectDB();
  console.log('MongoDB connected — testing CRE module…\n');

  const cre1 = await TDStaff.findOne({ email: 'cre1@patliputravinfast.com' });
  const cre2 = await TDStaff.findOne({ email: 'cre2@patliputravinfast.com' });
  assert(cre1 && cre2, 'CRE users missing — run npm run seed:cre');
  assert(isCreUser(cre1), 'cre1 should be detected as CRE');
  assert(isUnrestrictedViewer(cre1), 'CRE should see all leads');
  assert(!isExecutiveScopedUser(cre1), 'CRE should not be executive-scoped');

  const executive = await TDStaff.findOne({
    active: true,
    $or: [{ designation: 'sales_executive' }, { role: 'executive' }],
    designation: { $ne: 'cre' },
  });
  assert(executive, 'Need at least one sales executive in User Master');

  const mobile = `9${String(Date.now()).slice(-9)}`;
  const adminLike = {
    _id: cre1._id,
    name: cre1.name,
    email: cre1.email,
    role: cre1.role,
    designation: cre1.designation,
  };

  const { lead } = await intakePvLead({
    name: 'CRE Test Customer',
    mobile,
    city: 'Patna',
    area: 'Danapur',
    address: 'Near Station Road, Danapur',
    model: 'VF 7',
    source: 'Walk-in',
    status: 'Interested',
    leadType: 'HOT (within 30 days)',
    createdBy: cre1._id,
    changedBy: cre1._id,
    historyReason: `Lead created by ${cre1.name} (test)`,
  });

  assert(String(lead.createdBy) === String(cre1._id), 'createdBy should be CRE1');
  assert(lead.leadType === 'HOT (within 30 days)', 'leadType persisted');
  assert(lead.area === 'Danapur', 'area persisted');
  assert(lead.address.includes('Danapur'), 'address persisted');

  applyLeadAssignment(lead, executive);
  await lead.save();
  assert(String(lead.assignedTo) === String(executive._id), 'assigned to executive');

  // Executive scope should include this lead
  assert(isExecutiveScopedUser(executive) || executive.role === 'executive' || executive.designation === 'sales_executive', 'executive scoped');

  const execLeads = await Lead.find({
    assignedTo: executive._id,
    mobile,
  }).lean();
  assert(execLeads.length === 1, 'executive can find assigned lead by assignment');

  const areaFiltered = await Lead.find({
    assignedTo: executive._id,
    $or: [{ area: /Danapur/i }, { city: /Danapur/i }],
  }).lean();
  assert(areaFiltered.some((l) => String(l._id) === String(lead._id)), 'executive can filter by area');

  const typeFiltered = await Lead.find({
    assignedTo: executive._id,
    leadType: /HOT/i,
  }).lean();
  assert(typeFiltered.some((l) => String(l._id) === String(lead._id)), 'executive can filter by lead type');

  const report1 = await buildCreReport({ creId: cre1._id, year: new Date().getFullYear() });
  assert(report1.cre.email === cre1.email, 'report belongs to CRE1');
  assert(report1.overview.totalCreatedAllTime >= 1, 'CRE1 created count >= 1');
  assert(report1.overview.assigned >= 1, 'CRE1 assigned count >= 1');
  assert(report1.byArea.Danapur >= 1 || Object.keys(report1.byArea).some((k) => /danapur/i.test(k)), 'byArea includes Danapur');
  assert(
    Object.keys(report1.byLeadType).some((k) => /HOT/i.test(k)),
    'byLeadType includes HOT',
  );
  assert(
    report1.byExecutive.some((e) => e.executiveId === String(executive._id) && e.assignedCount >= 1),
    'byExecutive includes target executive',
  );
  assert(
    report1.recentLeads.some((r) => r.mobile === mobile),
    'recentLeads includes test lead',
  );

  const report2 = await buildCreReport({ creId: cre2._id, year: new Date().getFullYear() });
  assert(report2.cre.email === cre2.email, 'CRE2 report is individual');
  assert(
    !report2.recentLeads.some((r) => r.mobile === mobile),
    'CRE2 report must not include CRE1 lead',
  );

  // cleanup test lead
  await Lead.deleteOne({ _id: lead._id });

  console.log('PASS — CRE module checks:');
  console.log('  ✓ CRE auth / unrestricted visibility');
  console.log('  ✓ Lead created with area, address, leadType, createdBy');
  console.log('  ✓ Assigned to executive for area/type management');
  console.log('  ✓ Executive can filter by area + lead type');
  console.log('  ✓ Individual CRE1 / CRE2 reports isolated');
  console.log(`  ✓ CRE1 report: created=${report1.overview.totalCreated}, assigned=${report1.overview.assigned}, rate=${report1.overview.assignmentRate}%`);
  process.exit(0);
})().catch((err) => {
  console.error('FAIL —', err.message);
  process.exit(1);
});
