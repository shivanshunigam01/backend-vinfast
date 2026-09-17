/**
 * Import per-user CRE Excel files from a folder.
 * Assignment comes only from each row's SALES CONSULTANT column — blank stays unassigned.
 *
 * Usage:
 *   IMPORT_USER_DATA_CONFIRM=yes node src/scripts/importUserDataSheets.js "C:/Users/Admin/Downloads/Data"
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');
const Admin = require('../models/Admin');
const { importCurrentFormatRows } = require('../controllers/leadCrmController');
const { isCurrentFormatSheet } = require('../utils/creCurrentFormatImport');

/** Filename (without .xlsx) → User Master display name overrides. */
const FILENAME_STAFF_OVERRIDES = {
  'Aditya (SM)': 'Aditya',
  'Dilip (SM)': 'Dilip Choudhary',
  'Saurav (SM)': 'Saurav Kumar',
};

function normalizeConsultantName(raw) {
  return String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function staffNameFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  if (FILENAME_STAFF_OVERRIDES[base]) return FILENAME_STAFF_OVERRIDES[base];
  return base.replace(/\s*\((SM|SE|SH)\)\s*$/i, '').trim();
}

async function resolveStaffByFilename(filename, staffRows) {
  const target = normalizeConsultantName(staffNameFromFilename(filename));
  if (!target) return null;

  let hit = staffRows.find((s) => normalizeConsultantName(s.name) === target);
  if (hit) return hit;

  hit = staffRows.find((s) => {
    const n = normalizeConsultantName(s.name);
    return n.includes(target) || target.includes(n);
  });
  if (hit) return hit;

  const firstToken = target.split(/\s+/)[0];
  if (firstToken.length >= 3) {
    hit = staffRows.find((s) => {
      const n = normalizeConsultantName(s.name);
      return n === firstToken || n.startsWith(`${firstToken} `);
    });
  }
  return hit || null;
}

(async () => {
  try {
    if (process.env.IMPORT_USER_DATA_CONFIRM !== 'yes') {
      console.error('Set IMPORT_USER_DATA_CONFIRM=yes to import user data sheets.');
      process.exit(1);
    }

    const dir = process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'Data');
    if (!fs.existsSync(dir)) throw new Error(`Folder not found: ${dir}`);

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
        };
      }
    }
    if (!admin) throw new Error('No active superadmin found.');

    const staffRows = await TDStaff.find({ active: true }).select('_id name email role designation').lean();
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.xlsx')).sort();

    const totals = { created: 0, updated: 0, skipped: 0, failed: 0, followUpsCreated: 0, files: 0 };

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const staffHint = staffNameFromFilename(file);
      const staff = await resolveStaffByFilename(file, staffRows);

      const wb = XLSX.readFile(fullPath, { cellDates: true });
      const sheetName = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      if (!rows.length) {
        console.warn(`SKIP ${file} — empty sheet`);
        continue;
      }
      if (!isCurrentFormatSheet(rows)) {
        console.warn(`SKIP ${file} — not CRE Current Format`);
        continue;
      }

      const ownerLabel = staff ? staff.name : staffHint;
      console.log(`\n=== ${file} (${ownerLabel}, ${rows.length} rows) ===`);
      const results = await importCurrentFormatRows(admin, rows, {
        dryRun: false,
        updatesOnly: true,
      });

      totals.files += 1;
      totals.created += results.created;
      totals.updated += results.updated;
      totals.skipped += results.skipped || 0;
      totals.failed += results.failed.length;
      totals.followUpsCreated += results.followUpsCreated;

      console.log(
        `  created ${results.created}, updated ${results.updated}, skipped ${results.skipped || 0}, follow-ups ${results.followUpsCreated}, failed ${results.failed.length}`,
      );
      if (results.failed.length) {
        console.log('  first failures:', results.failed.slice(0, 3));
      }
    }

    console.log('\n=== All user sheets imported ===');
    console.log(totals);
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
})();
