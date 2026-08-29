const mongoose = require('mongoose');

const checklistItemConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    section: { type: String, trim: true },
    dataType: { type: String, enum: ['CHECKLIST', 'BOOLEAN', 'NUMBER', 'TEXT', 'PHOTO'], default: 'CHECKLIST' },
    options: [{ type: String, trim: true }],
    mandatory: { type: Boolean, default: true },
    modelFilter: [{ type: String, trim: true }],
    variantFilter: [{ type: String, trim: true }],
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: true },
);

const alertRuleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    thresholdHours: { type: Number },
    thresholdDays: { type: Number },
    thresholdSoc: { type: Number },
    recipientRoles: [{ type: String, trim: true }],
    deepLink: { type: String, trim: true },
  },
  { _id: true },
);

const stockConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, default: 'default' },
    poTypes: [{ type: String, trim: true }],
    paymentTerms: [{ type: String, trim: true }],
    ageingBuckets: [{ type: String, trim: true }],
    socLowThreshold: { type: Number, default: 20, min: 0, max: 100 },
    storageInspectionDays: { type: Number, default: 30 },
    reservationExpiryHours: { type: Number, default: 72 },
    pdiChecklist: { type: [checklistItemConfigSchema], default: [] },
    receiptChecklist: { type: [checklistItemConfigSchema], default: [] },
    grnExteriorChecklist: { type: [checklistItemConfigSchema], default: [] },
    alertRules: { type: [alertRuleSchema], default: [] },
    approvalMatrix: {
      poSubmitRoles: [{ type: String, trim: true }],
      poApproveRoles: [{ type: String, trim: true }],
      pdiOverrideRoles: [{ type: String, trim: true }],
      holdOverrideRoles: [{ type: String, trim: true }],
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('StockConfig', stockConfigSchema);
