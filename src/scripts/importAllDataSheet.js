/**
 * Import CRE Current Format Excel (e.g. All Data.xlsx) into CRM + TD bookings.
 *
 * Usage:
 *   IMPORT_ALL_DATA_CONFIRM=yes node src/scripts/importAllDataSheet.js "C:/path/All Data.xlsx"
 */
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');
const Admin = require('../models/Admin');
const { importCurrentFormatRows } = require('../controllers/leadCrmController');
const { isCurrentFormatSheet } = require('../utils/creCurrentFormatImport');

(async () => {
  try {
    if (process.env.IMPORT_ALL_DATA_CONFIRM !== 'yes') {
      console.error('Set IMPORT_ALL_DATA_CONFIRM=yes to run this import.');
      process.exit(1);
    }

    const filePath = process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'All Data.xlsx');
    await connectDB();

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
    if (!admin) {
      throw new Error('No active superadmin found (TDStaff or Admin).');
    }

    const wb = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    if (!rows.length) throw new Error('Sheet is empty');
    if (!isCurrentFormatSheet(rows)) throw new Error('Sheet is not CRE Current Format');

    console.log(`Importing ${rows.length} row(s) from ${filePath} as ${admin.name}…`);
    const results = await importCurrentFormatRows(admin, rows, { dryRun: false });
    console.log('\n=== Import complete ===');
    console.log(`Created: ${results.created}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Follow-ups: ${results.followUpsCreated}`);
    console.log(`Skipped: ${results.skipped || 0}`);
    console.log(`Failed: ${results.failed.length}`);
    if (results.failed.length) {
      console.log('First failures:', results.failed.slice(0, 10));
    }
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
})();
