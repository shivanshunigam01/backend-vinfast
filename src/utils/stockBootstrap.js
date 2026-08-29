const StockConfig = require('../models/StockConfig');

async function ensureStockConfigReady() {
  const existing = await StockConfig.findOne({ key: 'default' });
  if (existing) return;
  await StockConfig.create({
    key: 'default',
    poTypes: ['Regular', 'Additional', 'Demo', 'Test Drive', 'Replacement'],
    paymentTerms: ['Advance', 'Credit', 'Inventory Funding', 'Other'],
    ageingBuckets: ['0-15', '16-30', '31-45', '46-60', '61-90', '90+'],
    socLowThreshold: 20,
    storageInspectionDays: 30,
    reservationExpiryHours: 72,
    alertRules: [
      { key: 'grn_pending', label: 'GRN Pending', enabled: true, thresholdHours: 4, recipientRoles: ['manager'], deepLink: '/admin/stock/grn' },
      { key: 'pdi_pending', label: 'PDI Pending', enabled: true, thresholdHours: 24, recipientRoles: ['manager'], deepLink: '/admin/stock/pre-stock-pdi' },
      { key: 'low_soc', label: 'Low SOC', enabled: true, thresholdSoc: 20, recipientRoles: ['manager'], deepLink: '/admin/stock' },
    ],
    approvalMatrix: {
      poSubmitRoles: ['manager', 'superadmin'],
      poApproveRoles: ['manager', 'superadmin'],
      pdiOverrideRoles: ['manager', 'superadmin'],
      holdOverrideRoles: ['manager', 'superadmin'],
    },
  });
  console.log('[Stock bootstrap] default config seeded');
}

module.exports = { ensureStockConfigReady };
