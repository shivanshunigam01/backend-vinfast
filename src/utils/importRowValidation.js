const Lead = require('../models/Lead');
const { classifyImportRowSkip, parseCurrentFormatRow } = require('./creCurrentFormatImport');
const { normalizeLeadModelForStorage } = require('./leadModel');

function importOpportunityKey(mobile, model) {
  return `${mobile}|${normalizeLeadModelForStorage(model)}`;
}

/**
 * Validate one CRE Current Format row for bulk import review.
 * Returns { errors: [], warnings: [], parsed, skip }.
 */
async function validateImportRow({
  raw,
  rowNumber,
  batchKeys = new Set(),
  resolveConsultant,
  modelCorrections = {},
}) {
  const errors = [];
  const warnings = [];
  let parsed;

  try {
    const corrected = { ...raw, ...(modelCorrections[rowNumber] ? { MODEL: modelCorrections[rowNumber] } : {}) };
    parsed = parseCurrentFormatRow(corrected);
    const skipInfo = classifyImportRowSkip(parsed);
    if (skipInfo.skip) {
      return { errors, warnings, parsed, skip: skipInfo };
    }

    const name = String(parsed.name || '').trim();
    const mobile = parsed.mobile || '';

    if (!name || name.length < 2) {
      errors.push({ code: 'invalid_name', field: 'CUSTOMER NAME', message: 'Customer name is required' });
    }
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      errors.push({ code: 'invalid_phone', field: 'PHONE', message: 'Valid 10-digit mobile is required' });
    }

    const modelKey = importOpportunityKey(mobile, parsed.model || '');
    if (batchKeys.has(modelKey)) {
      errors.push({
        code: 'duplicate_batch',
        field: 'PHONE',
        message: 'Duplicate phone + model in this upload',
      });
    }

    if (mobile && parsed.model) {
      const existing = await Lead.findOne({
        mobile,
        model: normalizeLeadModelForStorage(parsed.model),
        isDuplicate: { $ne: true },
      })
        .select('leadId name')
        .lean();
      if (existing) {
        warnings.push({
          code: 'duplicate_lead',
          field: 'PHONE',
          message: `Existing lead ${existing.leadId} will be updated`,
        });
      }
    }

    const consultant = String(parsed.salesConsultant || raw['SALES CONSULTANT'] || '').trim();
    if (consultant && resolveConsultant) {
      const assignee = await resolveConsultant(consultant);
      if (!assignee) {
        errors.push({
          code: 'invalid_consultant',
          field: 'SALES CONSULTANT',
          message: `Unknown sales consultant: ${consultant}`,
        });
      }
    }

    if (!parsed.model || parsed.model === 'Both') {
      errors.push({
        code: 'needs_model',
        field: 'MODEL',
        message: 'Model must be specified (VF 6, VF 7, etc.)',
      });
    }
  } catch (err) {
    errors.push({
      code: 'invalid_field',
      field: '',
      message: err?.message || 'Failed to parse row',
    });
  }

  return { errors, warnings, parsed, skip: null };
}

module.exports = { validateImportRow, importOpportunityKey };
