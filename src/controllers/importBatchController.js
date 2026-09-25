const XLSX = require('xlsx');
const ImportBatch = require('../models/ImportBatch');
const ImportBatchRow = require('../models/ImportBatchRow');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { isCurrentFormatSheet } = require('../utils/creCurrentFormatImport');
const { validateImportRow, importOpportunityKey } = require('../utils/importRowValidation');
const { importCurrentFormatRows, resolveSalesConsultant } = require('./leadCrmController');

function parseSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function mergeRowCorrections(raw, corrections = {}) {
  const out = { ...raw };
  for (const [key, val] of Object.entries(corrections || {})) {
    if (val != null && String(val).trim() !== '') out[key] = val;
  }
  return out;
}

async function buildBatchValidation(admin, leadRows, fileName) {
  if (!leadRows.length) throw new ApiError(400, 'No rows found in sheet');
  if (!isCurrentFormatSheet(leadRows)) {
    throw new ApiError(400, 'Sheet is not CRE Current Format');
  }
  if (leadRows.length > 2000) throw new ApiError(400, 'Maximum 2000 rows per import');

  const batch = await ImportBatch.create({
    uploadedBy: admin._id,
    fileName: fileName || 'upload.xlsx',
    status: 'review',
    summary: { total: leadRows.length },
  });

  const batchKeys = new Set();
  const resolveConsultant = async (name) =>
    resolveSalesConsultant(null, name, admin);

  let valid = 0;
  let errors = 0;

  for (let i = 0; i < leadRows.length; i += 1) {
    const rowNum = i + 2;
    const raw = leadRows[i];
    const { errors: rowErrors, warnings, parsed, skip } = await validateImportRow({
      raw,
      rowNumber: rowNum,
      batchKeys,
      resolveConsultant,
    });

    const modelKey =
      parsed?.mobile && parsed?.model ? importOpportunityKey(parsed.mobile, parsed.model) : null;
    if (modelKey && !skip?.skip) batchKeys.add(modelKey);

    const status = skip?.skip ? 'skipped' : rowErrors.length ? 'error' : 'valid';
    if (status === 'valid') valid += 1;
    if (status === 'error') errors += 1;

    await ImportBatchRow.create({
      batchId: batch._id,
      rowNumber: rowNum,
      rawData: raw,
      parsedData: parsed || {},
      status,
      issues: [
        ...rowErrors,
        ...(warnings || []).map((w) => ({ ...w, code: w.code || 'warning' })),
      ],
      message: skip?.reason || rowErrors[0]?.message || warnings[0]?.message || '',
    });
  }

  batch.summary = { total: leadRows.length, valid, errors };
  await batch.save();

  return batch;
}

exports.previewImportBatch = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new ApiError(400, 'Excel file is required');

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames?.[0];
  const leadRows = parseSheetRows(workbook, sheetName);
  const batch = await buildBatchValidation(req.admin, leadRows, req.file.originalname);

  const rows = await ImportBatchRow.find({ batchId: batch._id }).sort({ rowNumber: 1 }).lean();

  return successResponse(
    res,
    { batch, rows },
    `Validated ${batch.summary.total} row(s): ${batch.summary.valid} valid, ${batch.summary.errors} with errors.`,
  );
});

exports.getImportBatch = asyncHandler(async (req, res) => {
  const batch = await ImportBatch.findById(req.params.id).lean();
  if (!batch) throw new ApiError(404, 'Import batch not found');
  if (String(batch.uploadedBy) !== String(req.admin._id) && req.admin.role !== 'superadmin') {
    throw new ApiError(403, 'Not allowed to view this import batch');
  }
  const rows = await ImportBatchRow.find({ batchId: batch._id }).sort({ rowNumber: 1 }).lean();
  return successResponse(res, { batch, rows });
});

exports.listImportBatches = asyncHandler(async (req, res) => {
  const filter = req.admin.role === 'superadmin' ? {} : { uploadedBy: req.admin._id };
  const batches = await ImportBatch.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  return successResponse(res, batches);
});

exports.updateImportBatchRow = asyncHandler(async (req, res) => {
  const batch = await ImportBatch.findById(req.params.batchId);
  if (!batch) throw new ApiError(404, 'Import batch not found');
  if (batch.status !== 'review') throw new ApiError(400, 'Batch is no longer editable');
  if (String(batch.uploadedBy) !== String(req.admin._id) && req.admin.role !== 'superadmin') {
    throw new ApiError(403, 'Not allowed to edit this import batch');
  }

  const row = await ImportBatchRow.findOne({ batchId: batch._id, rowNumber: Number(req.params.rowNumber) });
  if (!row) throw new ApiError(404, 'Row not found');

  row.corrections = { ...(row.corrections || {}), ...(req.body?.corrections || {}) };
  const mergedRaw = mergeRowCorrections(row.rawData, row.corrections);

  const resolveConsultant = async (name) => resolveSalesConsultant(null, name, req.admin);
  const { errors, warnings, parsed, skip } = await validateImportRow({
    raw: mergedRaw,
    rowNumber: row.rowNumber,
    resolveConsultant,
  });

  row.rawData = mergedRaw;
  row.parsedData = parsed || {};
  row.issues = [
    ...errors,
    ...(warnings || []).map((w) => ({ ...w, code: w.code || 'warning' })),
  ];
  row.status = skip?.skip ? 'skipped' : errors.length ? 'error' : 'corrected';
  row.message = skip?.reason || errors[0]?.message || 'Corrected — ready to import';
  await row.save();

  const allRows = await ImportBatchRow.find({ batchId: batch._id }).lean();
  batch.summary.valid = allRows.filter((r) => r.status === 'valid' || r.status === 'corrected').length;
  batch.summary.errors = allRows.filter((r) => r.status === 'error').length;
  batch.summary.corrected = allRows.filter((r) => r.status === 'corrected').length;
  await batch.save();

  return successResponse(res, row, 'Row updated');
});

exports.commitImportBatch = asyncHandler(async (req, res) => {
  const batch = await ImportBatch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Import batch not found');
  if (batch.status !== 'review') throw new ApiError(400, 'Batch already committed or cancelled');
  if (String(batch.uploadedBy) !== String(req.admin._id) && req.admin.role !== 'superadmin') {
    throw new ApiError(403, 'Not allowed to commit this import batch');
  }

  const rows = await ImportBatchRow.find({ batchId: batch._id }).sort({ rowNumber: 1 });
  const blocking = rows.filter((r) => r.status === 'error');
  if (blocking.length) {
    throw new ApiError(400, `${blocking.length} row(s) still have errors. Fix them before final upload.`);
  }

  const leadRows = rows
    .filter((r) => r.status !== 'skipped')
    .map((r) => mergeRowCorrections(r.rawData, r.corrections));

  const results = await importCurrentFormatRows(req.admin, leadRows, { dryRun: false });

  for (const row of rows) {
    if (row.status === 'skipped') continue;
    row.status = 'committed';
    await row.save();
  }

  batch.status = 'committed';
  batch.committedAt = new Date();
  batch.summary = {
    ...batch.summary,
    committed: leadRows.length,
    created: results.created,
    updated: results.updated,
    failed: results.failed.length,
  };
  await batch.save();

  return successResponse(
    res,
    { batch, results },
    `Imported ${results.created} created, ${results.updated} updated. ${results.failed.length} failed.`,
  );
});

exports.cancelImportBatch = asyncHandler(async (req, res) => {
  const batch = await ImportBatch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Import batch not found');
  if (batch.status !== 'review') throw new ApiError(400, 'Batch cannot be cancelled');
  batch.status = 'cancelled';
  await batch.save();
  return successResponse(res, batch, 'Import batch cancelled');
});
