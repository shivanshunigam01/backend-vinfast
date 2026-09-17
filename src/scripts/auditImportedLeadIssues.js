/**
 * Find data issues in already-imported CRM leads (consultant mismatch, TD gap, model issues).
 * Does not need Excel files — scans MongoDB.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const TDStaff = require('../models/TDStaff');
const { isValidLeadModel, normalizeLeadModelForStorage } = require('../utils/leadModel');

function normalizeConsultantName(raw) {
  return String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

(async () => {
  await connectDB();
  const staffRows = await TDStaff.find({ active: true }).select('name email designation').lean();
  const staffNames = new Set(staffRows.map((s) => normalizeConsultantName(s.name)));

  const leads = await Lead.find({
    $or: [
      { 'creSheet.enquiryDate': { $exists: true, $ne: null } },
      { source: /excel/i },
      { createdBy: { $exists: true } },
    ],
  })
    .select(
      'leadId name mobile model interestedModels source status assignedTo creSheet tdBookingId createdAt',
    )
    .lean();

  const issues = [];

  for (const lead of leads) {
    const row = {
      LeadId: lead.leadId || String(lead._id),
      Name: lead.name || '',
      Mobile: lead.mobile || '',
      Model: lead.model || '',
      EnquiryDate: lead.creSheet?.enquiryDate
        ? new Date(lead.creSheet.enquiryDate).toISOString().slice(0, 10)
        : '',
      SalesConsultantInSheet: lead.creSheet?.salesConsultantName || '',
      AssignedInCRM: lead.assignedTo ? 'Yes' : 'No',
    };

    const mobile = String(lead.mobile || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      issues.push({
        ...row,
        IssueType: 'invalid_phone',
        Error: `Invalid mobile "${lead.mobile}" — must be 10 digits starting 6–9`,
        FixInSheet: 'Correct PHONE column to valid 10-digit Indian mobile',
      });
    }

    const name = String(lead.name || '').trim();
    if (!name || name.length < 2) {
      issues.push({
        ...row,
        IssueType: 'missing_name',
        Error: 'Customer name missing or too short',
        FixInSheet: 'Fill CUSTOMER NAME (min 2 characters)',
      });
    }

    const modelStored = normalizeLeadModelForStorage(lead.model);
    if (lead.model && !isValidLeadModel(modelStored) && modelStored !== 'Both') {
      issues.push({
        ...row,
        IssueType: 'invalid_model',
        Error: `Unrecognized model "${lead.model}"`,
        FixInSheet: 'Set MODEL to VF 6, VF 7, Limo Green, VF MPV 7, or VF6,VF7 for Both',
      });
    }

    if (modelStored === 'Both' && (!lead.interestedModels || lead.interestedModels.length === 0)) {
      issues.push({
        ...row,
        IssueType: 'both_without_models',
        Error: 'MODEL is Both but no interested models parsed (e.g. "VF6, VF7")',
        FixInSheet: 'Use comma-separated models: VF6, VF7 or VF 6 / VF 7',
      });
    }

    const consultant = String(lead.creSheet?.salesConsultantName || '').trim();
    if (consultant && !lead.assignedTo) {
      const norm = normalizeConsultantName(consultant);
      const known = staffNames.has(norm)
        || staffRows.some((s) => {
          const n = normalizeConsultantName(s.name);
          return n.includes(norm) || norm.includes(n);
        });
      if (!known) {
        issues.push({
          ...row,
          IssueType: 'consultant_not_found',
          Error: `Sales consultant "${consultant}" not found in User Master`,
          FixInSheet: `Match name to User Master exactly (e.g. "Prashant (SE)" → staff name) or leave blank`,
        });
      }
    }

    const tdDate = lead.creSheet?.tdDate;
    const tdDone = lead.creSheet?.tdDone === true;
    if ((tdDate || tdDone) && !lead.tdBookingId) {
      issues.push({
        ...row,
        IssueType: 'td_not_synced',
        Error: 'Sheet has Test Drive date/done but no TD booking linked in CRM',
        FixInSheet: 'Check TEST DRIVE DATE format (valid date) and re-import row',
      });
    }
  }

  const outDir = path.join(process.env.USERPROFILE || '', 'Downloads');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(outDir, `crm-import-issues-from-db-${stamp}.xlsx`);

  const byType = {};
  for (const i of issues) {
    byType[i.IssueType] = (byType[i.IssueType] || 0) + 1;
  }
  const summary = Object.entries(byType).map(([type, count]) => ({ IssueType: type, Count: count }));
  summary.push({ IssueType: 'TOTAL_IMPORTED_LEADS_SCANNED', Count: leads.length });
  summary.push({ IssueType: 'TOTAL_ISSUE_ROWS', Count: issues.length });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(issues.length ? issues : [{ Note: 'No issues found in imported leads' }]),
    'Issues',
  );
  XLSX.writeFile(wb, outPath);

  console.log(JSON.stringify({ scannedLeads: leads.length, issueRows: issues.length, byType, report: outPath }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
