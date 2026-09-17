/**
 * Dry-run all CRE sheets and export every failed / skipped / needs_model row.
 *
 * Usage:
 *   node src/scripts/auditSheetImportErrors.js
 *   node src/scripts/auditSheetImportErrors.js "C:/path/All Data.xlsx" "C:/path/Data"
 *
 * Output: Downloads/import-error-report-<timestamp>.xlsx
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
const { isCurrentFormatSheet, parseCurrentFormatRow } = require('../utils/creCurrentFormatImport');

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

function readSheetRows(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  return rows;
}

function actionForIssue(row, updatesOnly) {
  if (row.status === 'needs_model') {
    return 'Set MODEL to VF 6 / VF 7 / Limo Green / VF MPV 7 (or VF6,VF7 for Both)';
  }
  if (row.status === 'skipped') {
    if (updatesOnly && String(row.message || '').includes('master')) {
      return 'Add this lead to All Data.xlsx first (same phone + model), then re-import user sheet';
    }
    if (String(row.message || '').includes('note row')) {
      return 'Replace with real customer row (name + 10-digit phone) or delete the note line';
    }
    if (String(row.message || '').includes('empty row')) {
      return 'Delete blank row or fill CUSTOMER NAME + PHONE';
    }
    if (String(row.message || '').includes('invalid phone')) {
      return 'Fix PHONE to valid 10-digit Indian mobile (starts 6–9)';
    }
    if (String(row.message || '').includes('missing customer name')) {
      return 'Fill CUSTOMER NAME (min 2 characters)';
    }
    return 'Fix row data and re-import';
  }
  return 'Fix PHONE (10-digit) and CUSTOMER NAME, then re-import';
}

function collectIssues(fileLabel, results, updatesOnly, staffNorm) {
  const out = [];
  for (const row of results.rows || []) {
    if (['failed', 'invalid', 'needs_model', 'skipped'].includes(row.status)) {
      const entry = {
        File: fileLabel,
        Row: row.row,
        Name: row.name || '',
        Mobile: row.mobile || '',
        Model: row.model || row.modelRaw || '',
        Status: row.status,
        Error: row.message || (row.status === 'skipped' ? 'Skipped' : 'Import failed'),
        Action: actionForIssue(row, updatesOnly),
      };
      out.push(entry);
      continue;
    }
  }
  for (const fail of results.failed || []) {
    const exists = out.some((r) => r.File === fileLabel && r.Row === fail.row);
    if (!exists) {
      out.push({
        File: fileLabel,
        Row: fail.row,
        Name: fail.name || '',
        Mobile: fail.mobile || '',
        Model: '',
        Status: 'failed',
        Error: fail.message || 'Import failed',
        Action: 'See error message and correct the Excel row',
      });
    }
  }
  return out;
}

(async () => {
  try {
    const allDataPath =
      process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'All Data.xlsx');
    const userDir = process.argv[3] || path.join(process.env.USERPROFILE || '', 'Downloads', 'Data');

    const files = [];
    if (fs.existsSync(allDataPath)) files.push({ path: allDataPath, label: path.basename(allDataPath), updatesOnly: false });
    if (fs.existsSync(userDir)) {
      for (const f of fs.readdirSync(userDir).filter((x) => x.toLowerCase().endsWith('.xlsx')).sort()) {
        files.push({ path: path.join(userDir, f), label: f, updatesOnly: true });
      }
    }

    if (!files.length) {
      console.error('No Excel files found.');
      console.error(`Expected: ${allDataPath}`);
      console.error(`And/or folder: ${userDir}`);
      process.exit(2);
    }

    await connectDB();
    const admin = await getAdmin();
    const staffRows = await TDStaff.find({ active: true }).select('name').lean();
    const staffNorm = staffRows.map((s) =>
      String(s.name || '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    );
    const allIssues = [];
    const summary = [];

    for (const file of files) {
      const rows = readSheetRows(file.path);
      if (!rows.length) {
        summary.push({ file: file.label, totalRows: 0, note: 'empty sheet' });
        continue;
      }
      if (!isCurrentFormatSheet(rows)) {
        summary.push({ file: file.label, totalRows: rows.length, note: 'NOT CRE Current Format' });
        continue;
      }

      const results = await importCurrentFormatRows(admin, rows, {
        dryRun: true,
        updatesOnly: file.updatesOnly,
      });
      const issues = collectIssues(file.label, results, file.updatesOnly, staffNorm);
      // Warn when SALES CONSULTANT text won't match User Master (row still imports, stays unassigned).
      for (const row of results.rows || []) {
        if (!['created', 'updated', 'would_create', 'would_update'].includes(row.status)) continue;
        const fromRaw = rows[row.row - 2];
        if (!fromRaw) continue;
        const parsed = parseCurrentFormatRow(fromRaw);
        const consultantCell = String(parsed.salesConsultant || '').trim();
        if (!consultantCell) continue;
        const norm = consultantCell
          .replace(/\([^)]*\)/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        const ok =
          staffNorm.includes(norm) ||
          staffNorm.some((s) => s.includes(norm) || norm.includes(s));
        if (!ok) {
          issues.push({
            File: file.label,
            Row: row.row,
            Name: row.name || '',
            Mobile: row.mobile || '',
            Model: row.model || row.modelRaw || '',
            Status: 'warning',
            Error: `Sales consultant "${consultantCell}" not found in User Master — lead imports but stays unassigned`,
            Action: 'Use exact User Master name (e.g. Prashant (SE)) or leave SALES CONSULTANT blank',
          });
        }
      }
      allIssues.push(...issues);
      summary.push({
        file: file.label,
        totalRows: rows.length,
        wouldCreate: results.created,
        wouldUpdate: results.updated,
        skipped: results.skipped || 0,
        needsModel: results.needsModel || 0,
        failed: results.failed.length,
        issueRows: issues.length,
      });
      console.log(`\n=== ${file.label} ===`);
      console.log(summary[summary.length - 1]);
      if (issues.length) {
        console.log('First issues:');
        for (const issue of issues.slice(0, 15)) {
          console.log(`  Row ${issue.Row}: [${issue.Status}] ${issue.Error} — ${issue.Name} / ${issue.Mobile}`);
        }
      }
    }

    const outDir = path.join(process.env.USERPROFILE || '', 'Downloads');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outPath = path.join(outDir, `import-error-report-${stamp}.xlsx`);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(allIssues.length ? allIssues : [{ Note: 'No failed or skipped rows found' }]),
      'Errors',
    );
    XLSX.writeFile(wb, outPath);

    console.log(`\n=== Report saved ===`);
    console.log(outPath);
    console.log(`Total issue rows: ${allIssues.length}`);
    process.exit(allIssues.length ? 1 : 0);
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
})();
