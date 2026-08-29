const StockConfig = require('../models/StockConfig');
const StockLocation = require('../models/StockLocation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');

const DEFAULT_CONFIG = {
  key: 'default',
  poTypes: ['Regular', 'Additional', 'Demo', 'Test Drive', 'Replacement'],
  paymentTerms: ['Advance', 'Credit', 'Inventory Funding', 'Other'],
  ageingBuckets: ['0-15', '16-30', '31-45', '46-60', '61-90', '90+'],
  socLowThreshold: 20,
  storageInspectionDays: 30,
  reservationExpiryHours: 72,
  pdiChecklist: [
    { key: 'charging_port', label: 'Charging Port/Flap', section: 'Charging', mandatory: true, options: ['OK', 'Damage', 'Fault'] },
    { key: 'ac_charging', label: 'AC Charging Test', section: 'Charging', mandatory: true, options: ['Pass', 'Fail', 'N/A'] },
    { key: 'lights_horn', label: 'Lights/Horn/Wiper', section: 'Functional', mandatory: true, options: ['Pass', 'Fail'] },
    { key: 'infotainment', label: 'Infotainment', section: 'Functional', mandatory: true, options: ['Pass', 'Fail'] },
    { key: 'climate', label: 'AC/Climate', section: 'Functional', mandatory: true, options: ['Pass', 'Fail'] },
    { key: 'body_paint', label: 'Body/Paint/Glass', section: 'Exterior', mandatory: true, options: ['Pass', 'Observation', 'Fail'] },
    { key: 'tpms', label: 'TPMS', section: 'Safety', mandatory: true, options: ['OK', 'Warning', 'Fault'] },
  ],
  receiptChecklist: [
    { key: 'oem_invoice', label: 'OEM Invoice', section: 'Documents', mandatory: true, options: ['Received', 'Pending', 'N/A'] },
    { key: 'lr_copy', label: 'LR Copy', section: 'Documents', mandatory: true, options: ['Received', 'Pending'] },
    { key: 'key_1', label: 'Key 1', section: 'Accessories', mandatory: true, options: ['Available', 'Missing', 'Damaged'] },
    { key: 'charging_cable', label: 'Charging Cable', section: 'Accessories', mandatory: false, options: ['Available', 'Missing', 'Damaged', 'N/A'] },
  ],
  alertRules: [
    { key: 'grn_pending', label: 'GRN Pending', enabled: true, thresholdHours: 4, recipientRoles: ['manager'], deepLink: '/admin/stock/grn' },
    { key: 'pdi_pending', label: 'PDI Pending', enabled: true, thresholdHours: 24, recipientRoles: ['manager'], deepLink: '/admin/stock/pre-stock-pdi' },
    { key: 'low_soc', label: 'Low SOC', enabled: true, thresholdSoc: 20, recipientRoles: ['manager'], deepLink: '/admin/stock' },
    { key: 'ageing_60', label: 'Ageing 60+', enabled: true, thresholdDays: 60, recipientRoles: ['manager'], deepLink: '/admin/stock' },
  ],
  approvalMatrix: {
    poSubmitRoles: ['manager', 'superadmin'],
    poApproveRoles: ['manager', 'superadmin'],
    pdiOverrideRoles: ['manager', 'superadmin'],
    holdOverrideRoles: ['manager', 'superadmin'],
  },
};

async function getOrCreateConfig() {
  let doc = await StockConfig.findOne({ key: 'default' });
  if (!doc) doc = await StockConfig.create(DEFAULT_CONFIG);
  return doc;
}

exports.getConfig = asyncHandler(async (_req, res) => {
  const doc = await getOrCreateConfig();
  return successResponse(res, doc);
});

exports.updateConfig = asyncHandler(async (req, res) => {
  const doc = await getOrCreateConfig();
  const body = req.body || {};
  const fields = [
    'poTypes', 'paymentTerms', 'ageingBuckets', 'socLowThreshold',
    'storageInspectionDays', 'reservationExpiryHours', 'pdiChecklist',
    'receiptChecklist', 'grnExteriorChecklist', 'alertRules', 'approvalMatrix',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) doc[f] = body[f];
  }
  doc.updatedBy = req.admin?._id;
  await doc.save();
  return successResponse(res, doc, 'Stock configuration updated');
});

exports.listLocations = asyncHandler(async (_req, res) => {
  const docs = await StockLocation.find().populate('branchId', 'name code city').lean();
  return successResponse(res, docs);
});

exports.upsertLocation = asyncHandler(async (req, res) => {
  const { branchId, yards, active } = req.body || {};
  if (!branchId) throw new ApiError(400, 'branchId is required');
  const doc = await StockLocation.findOneAndUpdate(
    { branchId },
    { branchId, yards: yards || [], active: active !== false },
    { upsert: true, new: true },
  );
  return successResponse(res, doc, 'Location master saved');
});

module.exports.getOrCreateConfig = getOrCreateConfig;
