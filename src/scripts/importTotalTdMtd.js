/**
 * Import VinFast CRM "Total TD MTD.xlsx" into Test Drive module + CRM creSheet (for MIS counts).
 *
 * Usage:
 *   IMPORT_TOTAL_TD_MTD_CONFIRM=yes node src/scripts/importTotalTdMtd.js "C:/Users/Admin/Downloads/Total TD MTD.xlsx"
 */
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
require('../models/tdModels');
const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const Lead = require('../models/Lead');
const TDStaff = require('../models/TDStaff');
const Admin = require('../models/Admin');
const { importTotalTdMtdRows, isTotalTdMtdSheet } = require('../utils/totalTdMtdImport');
const { indiaDateKey } = require('../utils/indiaDateTime');

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
  if (!admin) throw new Error('No active superadmin found (TDStaff or Admin).');
  return admin;
}

(async () => {
  if (process.env.IMPORT_TOTAL_TD_MTD_CONFIRM !== 'yes') {
    console.error('Set IMPORT_TOTAL_TD_MTD_CONFIRM=yes to run this import.');
    process.exit(1);
  }

  const filePath =
    process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'Total TD MTD.xlsx');

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!isTotalTdMtdSheet(rows)) {
    throw new Error(`File is not Total TD MTD format. Headers: ${Object.keys(rows[0] || {}).join(', ')}`);
  }

  await connectDB();
  const admin = await getAdmin();

  const before = {
    tdBookings: await TDBooking.countDocuments(),
    tdImported: await TDBooking.countDocuments({ vinfastImportSource: 'total_td_mtd' }),
    testDrives: await TestDrive.countDocuments(),
  };

  console.log(`Importing ${rows.length} rows from ${filePath} (${sheetName}) as ${admin.name}…`);
  const results = await importTotalTdMtdRows(admin, rows, { dryRun: false });

  const after = {
    tdBookings: await TDBooking.countDocuments(),
    tdImported: await TDBooking.countDocuments({ vinfastImportSource: 'total_td_mtd' }),
    tdCompletedImported: await TDBooking.countDocuments({
      vinfastImportSource: 'total_td_mtd',
      bookingStatus: 'COMPLETED',
    }),
    testDrives: await TestDrive.countDocuments(),
    leadsWithTdDone: await Lead.countDocuments({ 'creSheet.tdDone': true }),
  };

  const now = new Date();
  const monthKey = indiaDateKey(now).slice(0, 7);
  const mtdImported = await TDBooking.countDocuments({
    vinfastImportSource: 'total_td_mtd',
    bookingStatus: { $nin: ['CANCELLED', 'MISSED'] },
    slotDate: {
      $gte: new Date(`${monthKey}-01T00:00:00+05:30`),
      $lte: now,
    },
  });

  console.log('\n=== Import result ===');
  console.log(JSON.stringify({ ...results, before, after, mtdImportedThisMonth: mtdImported }, null, 2));

  if (results.failed.length) {
    console.error(`\nFAILED ${results.failed.length} row(s):`);
    results.failed.forEach((f) => console.error(f));
    process.exit(1);
  }

  process.exit(0);
})().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
