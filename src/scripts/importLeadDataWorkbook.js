/**
 * Import Lead Data.xlsx (All Lead CRM Sheet + Total TD Sheet).
 *
 * Usage:
 *   IMPORT_LEAD_DATA_CONFIRM=yes node src/scripts/importLeadDataWorkbook.js "C:/Users/Admin/Downloads/Lead Data.xlsx"
 */
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDStaff = require('../models/TDStaff');
const Admin = require('../models/Admin');
const { importCurrentFormatRows } = require('../controllers/leadCrmController');
const { isCurrentFormatSheet } = require('../utils/creCurrentFormatImport');

async function getAdmin() {
  let admin = await TDStaff.findOne({ role: 'superadmin', active: true }).select('_id name email role');
  if (!admin) {
    const portalAdmin = await Admin.findOne({ role: 'superadmin', active: true }).select('_id name email role');
    if (portalAdmin) {
      admin = {
        _id: portalAdmin._id,
        name: portalAdmin.name,
        email: portalAdmin.email,
        role: 'superadmin',
        userType: 'admin',
      };
    }
  }
  if (!admin) throw new Error('No active superadmin found (TDStaff or Admin).');
  return admin;
}

async function importSheet(admin, filePath, sheetName, { updatesOnly = false } = {}) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  if (!wb.Sheets[sheetName]) throw new Error(`Missing sheet: ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!rows.length) throw new Error(`Empty sheet: ${sheetName}`);
  if (!isCurrentFormatSheet(rows)) throw new Error(`Not CRE Current Format: ${sheetName}`);

  console.log(`\n=== ${sheetName} (${rows.length} rows) ${updatesOnly ? 'update-only' : 'master'} ===`);
  const results = await importCurrentFormatRows(admin, rows, { dryRun: false, updatesOnly });
  console.log({
    created: results.created,
    updated: results.updated,
    skipped: results.skipped || 0,
    followUpsCreated: results.followUpsCreated,
    failed: results.failed.length,
  });
  if (results.failed.length) {
    console.log('First failures:', results.failed.slice(0, 10));
  }
  return results;
}

async function syncEnquiryDates() {
  const leads = await Lead.find({ 'creSheet.enquiryDate': { $exists: true, $ne: null } })
    .select('_id creSheet.enquiryDate')
    .lean();
  for (const lead of leads) {
    await Lead.collection.updateOne(
      { _id: lead._id },
      { $set: { createdAt: lead.creSheet.enquiryDate } },
    );
  }
  return leads.length;
}

(async () => {
  if (process.env.IMPORT_LEAD_DATA_CONFIRM !== 'yes') {
    console.error('Set IMPORT_LEAD_DATA_CONFIRM=yes to run this import.');
    process.exit(1);
  }

  const filePath =
    process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'Lead Data.xlsx');

  await connectDB();
  const admin = await getAdmin();
  console.log(`Importing ${filePath} as ${admin.name}…`);

  const master = await importSheet(admin, filePath, 'All Lead CRM Sheet', { updatesOnly: false });
  const td = await importSheet(admin, filePath, 'Total TD Sheet', { updatesOnly: true });
  const synced = await syncEnquiryDates();

  const counts = {
    leads: await Lead.countDocuments(),
    bothModel: await Lead.countDocuments({ model: 'Both' }),
    tdBookings: await TDBooking.countDocuments(),
    followUps: await LeadFollowUp.countDocuments(),
    enquiryDatesSynced: synced,
  };

  console.log('\n=== Import complete ===');
  console.log({ master, td: { updated: td.updated, skipped: td.skipped, failed: td.failed.length } });
  console.log('Final counts:', counts);
  process.exit(0);
})().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
