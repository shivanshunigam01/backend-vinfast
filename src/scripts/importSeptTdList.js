/**
 * Import Sept TD list.xlsx into CRM + test-drive bookings.
 * Sheet1: full TD rows (update existing leads + sync TDBooking).
 * TD SEPTEMBER: September TD list (update + create linked/new leads).
 *
 * Usage:
 *   IMPORT_SEPT_TD_CONFIRM=yes node src/scripts/importSeptTdList.js "C:/Users/Admin/Downloads/Sept TD list.xlsx"
 */
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const TDStaff = require('../models/TDStaff');
const Admin = require('../models/Admin');
const { importCurrentFormatRows } = require('../controllers/leadCrmController');
const { isCurrentFormatSheet } = require('../utils/creCurrentFormatImport');
const { syncTestDriveBookingFromCreSheet } = require('../utils/crmCreSheetSync');

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

function findSheetName(wb, candidates) {
  for (const c of candidates) {
    const hit = wb.SheetNames.find((n) => n.trim().toLowerCase() === c.trim().toLowerCase());
    if (hit) return hit;
  }
  return null;
}

async function importSheet(admin, wb, sheetName, { updatesOnly = false } = {}) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!rows.length) throw new Error(`Empty sheet: ${sheetName}`);
  if (!isCurrentFormatSheet(rows)) throw new Error(`Not CRE-compatible TD sheet: ${sheetName}`);

  console.log(`\n=== ${sheetName} (${rows.length} rows) ${updatesOnly ? 'update-only' : 'create+update'} ===`);
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

(async () => {
  if (process.env.IMPORT_SEPT_TD_CONFIRM !== 'yes') {
    console.error('Set IMPORT_SEPT_TD_CONFIRM=yes to run this import.');
    process.exit(1);
  }

  const filePath =
    process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'Sept TD list.xlsx');

  await connectDB();
  const admin = await getAdmin();
  const wb = XLSX.readFile(filePath, { cellDates: true });

  const sheet1 = findSheetName(wb, ['Sheet1']) || wb.SheetNames[0];
  const tdSept = findSheetName(wb, ['TD SEPTEMBER', 'TD SEPTEMBER ']) || wb.SheetNames[1];

  console.log(`Importing ${filePath} as ${admin.name}…`);
  console.log('Sheets:', wb.SheetNames.join(', '));

  const before = {
    leads: await Lead.countDocuments(),
    tdBookings: await TDBooking.countDocuments(),
  };

  // TD SEPTEMBER first (TD dates + new leads); Sheet1 last (richer columns: mail, location, Month Year).
  const tdResult = await importSheet(admin, wb, tdSept, { updatesOnly: false });
  const sheet1Result = await importSheet(admin, wb, sheet1, { updatesOnly: true });

  const monthYearLeads = await Lead.find({ 'creSheet.monthYear': { $exists: true, $ne: null } })
    .select('_id assignedTo creSheet tdBookingId')
    .lean();
  for (const row of monthYearLeads) {
    const lead = await Lead.findById(row._id);
    if (lead?.creSheet?.tdDate || lead?.creSheet?.tdDone) {
      await syncTestDriveBookingFromCreSheet(lead, { assigneeId: lead.assignedTo });
    }
  }

  const after = {
    leads: await Lead.countDocuments(),
    tdBookings: await TDBooking.countDocuments(),
    tdCompleted: await TDBooking.countDocuments({ bookingStatus: 'COMPLETED' }),
    tdConfirmed: await TDBooking.countDocuments({ bookingStatus: 'CONFIRMED' }),
    septMonthYear: await Lead.countDocuments({ 'creSheet.monthYear': { $exists: true, $ne: null } }),
  };

  console.log('\n=== Import complete ===');
  console.log({ before, sheet1Result: { updated: sheet1Result.updated, skipped: sheet1Result.skipped }, tdResult: { created: tdResult.created, updated: tdResult.updated, skipped: tdResult.skipped, failed: tdResult.failed.length } });
  console.log('After:', after);
  process.exit(0);
})().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
