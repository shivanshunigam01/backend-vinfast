/**
 * Import a CRE Current Format workbook into CRM + TD bookings + assignments.
 *
 * Usage:
 *   IMPORT_CRE_WORKBOOK_CONFIRM=yes node src/scripts/importCreLeadsWorkbook.js "C:/path/file.xlsx"
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
const { normalizeLeadModelForStorage } = require('../utils/leadModel');

const CONSULTANT_ALIASES = {
  'rahul singh 1': 'Rahul Singh (SM)',
  'rahul kumar 1': 'Rahul Kumar (SM)',
  'rahul singh': 'Rahul Singh (SM)',
  'rahul kumar sm': 'Rahul Kumar (SM)',
  'rahul kumar': 'Rahul Kumar (SM)',
  'saurav 1': 'Saurav Kumar',
  'saurav': 'Saurav Kumar',
  'aditya sm': 'Aditya',
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

async function findLeadForParsed(parsed) {
  const model = normalizeLeadModelForStorage(parsed.model);
  let lead = await Lead.findOne({
    mobile: parsed.mobile,
    model,
    isDuplicate: { $ne: true },
  }).sort({ updatedAt: -1 });
  if (!lead && model === 'Both') {
    lead = await Lead.findOne({
      mobile: parsed.mobile,
      isDuplicate: { $ne: true },
    }).sort({ updatedAt: -1 });
  }
  if (!lead) {
    lead = await Lead.findOne({
      mobile: parsed.mobile,
      isDuplicate: { $ne: true },
    }).sort({ updatedAt: -1 });
  }
  return lead;
}

(async () => {
  if (process.env.IMPORT_CRE_WORKBOOK_CONFIRM !== 'yes') {
    console.error('Set IMPORT_CRE_WORKBOOK_CONFIRM=yes to run this import.');
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Provide workbook path as first argument.');
    process.exit(1);
  }

  await connectDB();
  const admin = await getAdmin();
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName =
    process.argv[3] ||
    wb.SheetNames.find((n) => /^mastersheet$/i.test(String(n).trim())) ||
    wb.SheetNames[0];
  let rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!rows.length) throw new Error('Sheet is empty');
  if (!isCurrentFormatSheet(rows)) throw new Error('Sheet is not CRE Current Format');

  rows = applyConsultantAliases(rows);

  const before = {
    leads: await Lead.countDocuments(),
    tdBookings: await TDBooking.countDocuments(),
  };

  console.log(`\nImporting ${rows.length} row(s) from ${path.basename(filePath)} [${sheetName}] as ${admin.name}…`);

  const results = await importCurrentFormatRows(admin, rows, {
    dryRun: false,
    updatesOnly: false,
    oneRowOneLead: true,
  });

  let tdSynced = 0;
  for (const row of rows) {
    const parsed = parseCurrentFormatRow(row);
    if (!parsed.mobile || !parsed.name) continue;
    if (parsed.creSheet?.tdDone !== true) continue;

    const lead = await findLeadForParsed(parsed);
    if (!lead) continue;

    const enquiry = parsed.creSheet?.enquiryDate || parsed.creSheet?.tdDate;
    if (enquiry && !lead.creSheet?.monthYear) {
      const d = new Date(enquiry);
      if (!Number.isNaN(d.getTime())) {
        lead.creSheet = {
          ...(lead.creSheet?.toObject?.() || lead.creSheet || {}),
          monthYear: new Date(d.getFullYear(), d.getMonth(), 1),
        };
        await lead.save();
      }
    }

    await syncTestDriveBookingFromCreSheet(lead, { assigneeId: lead.assignedTo });
    tdSynced += 1;
  }

  const after = {
    leads: await Lead.countDocuments(),
    tdBookings: await TDBooking.countDocuments(),
    tdCompleted: await TDBooking.countDocuments({ bookingStatus: 'COMPLETED' }),
    tdConfirmed: await TDBooking.countDocuments({ bookingStatus: 'CONFIRMED' }),
    aprToAugEnquiries: await Lead.countDocuments({
      'creSheet.enquiryDate': {
        $gte: new Date(2026, 3, 1),
        $lt: new Date(2026, 8, 1),
      },
    }),
    unassignedAprAug: await Lead.countDocuments({
      assignedTo: null,
      'creSheet.enquiryDate': { $gte: new Date(2026, 3, 1), $lt: new Date(2026, 8, 1) },
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
  if (results.failed.length) console.log('Failures (first 20):', results.failed.slice(0, 20));
  console.log('\nBefore / After:', { before, after });
  process.exit(results.failed.length ? 1 : 0);
})().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
