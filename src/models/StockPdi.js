const mongoose = require('mongoose');
const { PDI_RESULTS } = require('../constants/stockPipeline');

const PDI_TYPES = ['YARD', 'PRE_STOCK', 'FINAL'];

const checklistItemSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true },
    label: { type: String, trim: true },
    section: { type: String, trim: true },
    value: { type: String, trim: true },
    ok: { type: Boolean, default: true },
    note: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
  },
  { _id: false },
);

const stockPdiSchema = new mongoose.Schema(
  {
    pdiNumber: { type: String, trim: true, index: true },
    type: { type: String, enum: PDI_TYPES, required: true, index: true },
    result: { type: String, enum: PDI_RESULTS, required: true },
    vehicleStockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleStock',
      required: true,
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleOrder', index: true },
    vin: { type: String, trim: true, uppercase: true },
    pdiDatetime: { type: Date, default: Date.now },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    odometer: { type: Number, min: 0 },
    socPercent: { type: Number, min: 0, max: 100 },
    hvBatteryStatus: { type: String, enum: ['OK', 'WARNING', 'FAULT', 'NOT_CHECKED'] },
    batteryWarning: { type: Boolean, default: false },
    diagnosticScan: { type: Boolean, default: false },
    dtcPresent: { type: Boolean, default: false },
    softwareVersion: { type: String, trim: true },
    otaPending: { type: Boolean, default: false },
    roadTestRequired: { type: Boolean, default: false },
    roadTestKm: { type: Number, min: 0 },
    roadTestResult: { type: String, trim: true },
    socBefore: { type: Number, min: 0, max: 100 },
    socAfter: { type: Number, min: 0, max: 100 },
    managerApproval: { type: Boolean, default: false },
    managerApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    checklist: { type: [checklistItemSchema], default: [] },
    notes: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    performedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model('StockPdi', stockPdiSchema);
module.exports.PDI_TYPES = PDI_TYPES;
module.exports.PDI_RESULTS = PDI_RESULTS;
