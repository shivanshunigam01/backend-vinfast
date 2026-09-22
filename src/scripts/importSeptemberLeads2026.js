/**
 * Import "September leads -2026.xlsx" into CRM + TD bookings + assignments.
 *
 * Usage:
 *   IMPORT_SEPT_LEADS_2026_CONFIRM=yes node src/scripts/importSeptemberLeads2026.js "C:/Users/.../September leads -2026.xlsx"
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
const { isCurrentFormatSheet, parseCurrentFormatRow } = require('../utils/creCurrentFormatImport');
const { syncTestDriveBookingFromCreSheet } = require('../utils/crmCreSheetSync');

const CONSULTANT_ALIASES = {
  'rahul singh 1': 'Rahul Singh (SM)',
  'rahul kumar 1': 'Rahul Kumar (SM)',
  'rahul singh': 'Rahul Singh (SM)',
  'rahul kumar sm': 'Rahul Kumar (SM)',
  'rahul kumar': 'Rahul Kumar (SM)',
};

function normalizeConsultant(raw) {
  return String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function applyConsultantAliases(rows) {
  return rows.map((row) => {
    const key = normalizeConsultant(row['SALES CONSULTANT']);
    const alias = CONSULTANT_ALIASES[key];
    if (!alias) return row;
    return { ...row, 'SALES CONSULTANT': alias };
  });
}

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
  if (!admin) throw new Error('No active superadmin found.');
  return admin;
}

(async () => {
  if (process.env.IMPORT_SEPT_LEADS_2026_CONFIRM !== 'yes') {
    console.error('Set IMPORT_SEPT_LEADS_2026_CONFIRM=yes to run this import.');
    process.exit(1);
  }

  const filePath =
    process.argv[2] ||
    path.join(process.env.USERPROFILE || '', 'Downloads', 'September leads -2026.xlsx');

  await connectDB();
  const admin = await getAdmin();
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  let rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!rows.length) throw new Error('Sheet is empty');
  if (!isCurrentFormatSheet(rows)) throw new Error('Sheet is not CRE Current Format');

  rows = applyConsultantAliases(rows);

  // Default Month Year for September reporting when column is blank.
  rows = rows.map((row) => {
    const parsed = parseCurrentFormatRow(row);
    const monthYear = parsed.creSheet?.monthYear || parsed.creSheet?.enquiryDate || parsed.creSheet?.tdDate;
    if (!monthYear) return row;
    const d = new Date(monthYear);
    if (Number.isNaN(d.getTime())) return row;
    if (d.getMonth() === 8 && d.getFullYear() === 2026) {
      return { ...row, 'Month Year': 'September 2026' };
    }
    return row;
  });

  const before = {
    leads: await Lead.countDocuments(),
    tdBookings: await TDBooking.countDocuments(),
  };

  console.log(`\nImporting ${rows.length} row(s) from ${path.basename(filePath)} as ${admin.name}…`);

  const results = await importCurrentFormatRows(admin, rows, { dryRun: false, updatesOnly: false });

  const importedLeadIds = new Set();
  for (const row of results.rows || []) {
    if (row.leadId && ['created', 'updated'].includes(row.status)) {
      const lead = await Lead.findOne({ leadId: row.leadId }).select('_id').lean();
      if (lead) importedLeadIds.add(String(lead._id));
    }
  }

  // Sync TD bookings for every row with TD date/done from this file.
  let tdSynced = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const parsed = parseCurrentFormatRow(rows[i]);
    if (!parsed.mobile || !parsed.name) continue;
    if (!parsed.creSheet?.tdDate && parsed.creSheet?.tdDone !== true) continue;

    const lead = await Lead.findOne({ mobile: parsed.mobile, isDuplicate: { $ne: true } })
      .sort({ updatedAt: -1 });
    if (!lead) continue;

    if (!lead.creSheet?.monthYear && parsed.creSheet?.enquiryDate) {
      const d = new Date(parsed.creSheet.enquiryDate);
      if (!Number.isNaN(d.getTime()) && d.getMonth() === 8 && d.getFullYear() === 2026) {
        lead.creSheet = { ...(lead.creSheet || {}), monthYear: new Date(2026, 8, 1) };
      }
    }

    await syncTestDriveBookingFromCreSheet(lead, { assigneeId: lead.assignedTo });
    tdSynced += 1;
    importedLeadIds.add(String(lead._id));
  }

  const assignedByStaff = await Lead.aggregate([
    {
      $match: {
        _id: { $in: [...importedLeadIds].map((id) => new (require('mongoose').Types.ObjectId)(id)) },
        assignedTo: { $exists: true, $ne: null },
      },
    },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);
  const staffMap = new Map(
    (await TDStaff.find({}).select('name').lean()).map((s) => [String(s._id), s.name]),
  );
  const byConsultant = assignedByStaff.map((r) => ({
    name: staffMap.get(String(r._id)) || String(r._id),
    leads: r.count,
  }));

  const after = {
    leads: await Lead.countDocuments(),
    tdBookings: await TDBooking.countDocuments(),
    tdCompleted: await TDBooking.countDocuments({ bookingStatus: 'COMPLETED' }),
    tdConfirmed: await TDBooking.countDocuments({ bookingStatus: 'CONFIRMED' }),
    septEnquiryLeads: await Lead.countDocuments({
      'creSheet.enquiryDate': {
        $gte: new Date(2026, 8, 1),
        $lt: new Date(2026, 9, 1),
      },
    }),
    unassignedFromFile: await Lead.countDocuments({
      assignedTo: null,
      'creSheet.enquiryDate': { $gte: new Date(2026, 8, 1), $lt: new Date(2026, 9, 1) },
    }),
  };

  console.log('\n=== Import complete ===');
  console.log({
    created: results.created,
    updated: results.updated,
    skipped: results.skipped || 0,
    followUpsCreated: results.followUpsCreated,
    failed: results.failed.length,
    tdSynced,
  });
  if (results.failed.length) console.log('Failures:', results.failed);
  console.log('\nAssigned (this import batch):');
  console.table(byConsultant.sort((a, b) => b.leads - a.leads));
  console.log('\nBefore / After:', { before, after });
  process.exit(results.failed.length ? 1 : 0);
})().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
