/**
 * Full CRM import: All Data.xlsx (master count) + user sheets (update-only).
 *
 * Usage:
 *   IMPORT_MASTER_CONFIRM=yes node src/scripts/importMasterData.js
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
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
      };
    }
  }
  if (!admin) throw new Error('No active superadmin found.');
  return admin;
}

async function importFile(admin, filePath, { updatesOnly = false } = {}) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  if (!rows.length) throw new Error(`Empty sheet: ${filePath}`);
  if (!isCurrentFormatSheet(rows)) throw new Error(`Not CRE format: ${filePath}`);
  return importCurrentFormatRows(admin, rows, { dryRun: false, updatesOnly });
}

async function syncEnquiryDates() {
  const leads = await Lead.find({ 'creSheet.enquiryDate': { $exists: true, $ne: null } })
    .select('_id creSheet.enquiryDate')
    .lean();
  let n = 0;
  for (const lead of leads) {
    await Lead.collection.updateOne(
      { _id: lead._id },
      { $set: { createdAt: lead.creSheet.enquiryDate } },
    );
    n += 1;
  }
  return n;
}

(async () => {
  try {
    if (process.env.IMPORT_MASTER_CONFIRM !== 'yes') {
      console.error('Set IMPORT_MASTER_CONFIRM=yes to run master import.');
      process.exit(1);
    }

    await connectDB();
    const admin = await getAdmin();
    const allDataPath = path.join(process.env.USERPROFILE || '', 'Downloads', 'All Data.xlsx');
    const userDir = path.join(process.env.USERPROFILE || '', 'Downloads', 'Data');

    console.log('\n=== Step 1: All Data.xlsx (master) ===');
    const master = await importFile(admin, allDataPath, { updatesOnly: false });
    console.log(master);

    const masterCount = await Lead.countDocuments();
    console.log(`Leads after master import: ${masterCount}`);

    console.log('\n=== Step 2: User sheets (update-only) ===');
    const userTotals = { updated: 0, skipped: 0, failed: 0, files: 0 };
    if (fs.existsSync(userDir)) {
      const files = fs.readdirSync(userDir).filter((f) => f.toLowerCase().endsWith('.xlsx')).sort();
      for (const file of files) {
        console.log(`\n--- ${file} ---`);
        const r = await importFile(admin, path.join(userDir, file), { updatesOnly: true });
        userTotals.files += 1;
        userTotals.updated += r.updated;
        userTotals.skipped += r.skipped || 0;
        userTotals.failed += r.failed.length;
        console.log(`updated ${r.updated}, skipped ${r.skipped || 0}, failed ${r.failed.length}`);
      }
    }
    console.log('\nUser sheet totals:', userTotals);

    const finalCount = await Lead.countDocuments();
    const bothCount = await Lead.countDocuments({ model: 'Both' });
    const synced = await syncEnquiryDates();

    console.log('\n=== Done ===');
    console.log({
      masterRows: master.created + master.updated + (master.skipped || 0) + master.failed.length,
      totalLeadsInDb: finalCount,
      bothModelLeads: bothCount,
      enquiryDatesSynced: synced,
    });
    process.exit(0);
  } catch (err) {
    console.error('Master import failed:', err);
    process.exit(1);
  }
})();
