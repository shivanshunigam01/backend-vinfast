const mongoose = require('mongoose');

const PO_STATUSES = ['DRAFT', 'RAISED', 'PARTIAL', 'CLOSED', 'CANCELLED'];

const poLineSchema = new mongoose.Schema(
  {
    model: { type: String, required: true, trim: true },
    variant: { type: String, trim: true },
    colour: { type: String, trim: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
    receivedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, trim: true, index: true },
    status: { type: String, enum: PO_STATUSES, default: 'DRAFT', index: true },
    supplier: { type: String, trim: true, default: 'VinFast' },
    expectedDate: { type: Date },
    remarks: { type: String, trim: true },
    lines: { type: [poLineSchema], default: [] },
    raisedAt: { type: Date },
    closedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
module.exports.PO_STATUSES = PO_STATUSES;
