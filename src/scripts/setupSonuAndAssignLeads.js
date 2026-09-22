/**
 * Create / activate Sonu (SE) under Dilip Choudhary and assign pending September leads.
 *
 * Usage:
 *   SETUP_SONU_CONFIRM=yes node src/scripts/setupSonuAndAssignLeads.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const TDStaff = require('../models/TDStaff');
const LeadStageHistory = require('../models/LeadStageHistory');

const SONU = {
  name: 'Sonu',
  email: 'sonu@patliputravinfast.com',
  designation: 'sales_executive',
  role: 'executive',
};
const MANAGER_EMAIL = 'dilip.choudhary@patliputravinfast.com';
const DEFAULT_PASSWORD = process.env.SEED_TD_TEAM_PASSWORD || 'Patliputra@123';
const LEAD_IDS = ['PVLEAD1081', 'PVLEAD1082', 'PVLEAD1109'];

(async () => {
  if (process.env.SETUP_SONU_CONFIRM !== 'yes') {
    console.error('Set SETUP_SONU_CONFIRM=yes to run.');
    process.exit(1);
  }

  await connectDB();

  const manager = await TDStaff.findOne({ email: MANAGER_EMAIL, active: true });
  if (!manager) {
    throw new Error(`Manager not found: ${MANAGER_EMAIL}. Run seed:td-team first.`);
  }

  let sonu = await TDStaff.findOne({ email: SONU.email });
  if (sonu) {
    sonu.name = SONU.name;
    sonu.designation = SONU.designation;
    sonu.role = SONU.role;
    sonu.reportsTo = manager._id;
    sonu.active = true;
    if (!sonu.password) {
      sonu.password = DEFAULT_PASSWORD;
    }
    await sonu.save();
    console.log('Updated existing Sonu:', sonu.email);
  } else {
    sonu = await TDStaff.create({
      ...SONU,
      password: DEFAULT_PASSWORD,
      reportsTo: manager._id,
      active: true,
    });
    console.log('Created Sonu:', sonu.email, '| default password:', DEFAULT_PASSWORD);
  }

  const assigned = [];
  for (const leadId of LEAD_IDS) {
    const lead = await Lead.findOne({ leadId });
    if (!lead) {
      console.warn(`Lead not found: ${leadId}`);
      continue;
    }
    const prev = lead.assignedTo;
    lead.assignedTo = sonu._id;
    lead.assignedToEmail = sonu.email;
    if (lead.creSheet) {
      lead.creSheet.salesConsultantName = 'Sonu (SE)';
    } else {
      lead.creSheet = { salesConsultantName: 'Sonu (SE)' };
    }
    lead.lastActivityAt = new Date();
    await lead.save();
    await LeadStageHistory.create({
      leadId: lead._id,
      fromStage: lead.status,
      toStage: lead.status,
      changedBy: sonu._id,
      reason: `Assigned to ${sonu.name} (SE) — September leads import correction`,
    });
    assigned.push({
      leadId: lead.leadId,
      name: lead.name,
      mobile: lead.mobile,
      previousAssignee: prev ? String(prev) : null,
    });
  }

  console.log('\nAssigned leads:');
  console.table(assigned);
  console.log('\nSonu staff id:', String(sonu._id));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
