const mongoose = require('mongoose');
const { RECEIPT_STATUSES } = require('../constants/stockPipeline');

const checklistValueSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true },
    label: { type: String, trim: true },
    value: { type: String, trim: true },
    ok: { type: Boolean, default: true },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const receiptVerificationSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, unique: true, trim: true, index: true },
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    vin: { type: String, required: true, trim: true, uppercase: true },
    grnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grn', index: true },
    documents: { type: [checklistValueSchema], default: [] },
    accessories: { type: [checklistValueSchema], default: [] },
    receiptStatus: { type: String, enum: RECEIPT_STATUSES, required: true },
    remarks: { type: String, trim: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    verifiedAt: { type: Date, default: Date.now },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ReceiptVerification', receiptVerificationSchema);
