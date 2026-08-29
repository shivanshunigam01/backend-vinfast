const mongoose = require('mongoose');
const { PO_STATUSES } = require('../constants/stockPipeline');

const approvalEntrySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true },
    status: { type: String, trim: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    byName: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    remarks: { type: String, trim: true },
  },
  { _id: true },
);

const poLineSchema = new mongoose.Schema(
  {
    model: { type: String, required: true, trim: true },
    variant: { type: String, trim: true },
    colour: { type: String, trim: true },
    interiorColour: { type: String, trim: true },
    batteryConfig: { type: String, trim: true },
    modelYear: { type: Number },
    qty: { type: Number, required: true, min: 1, default: 1 },
    receivedQty: { type: Number, default: 0, min: 0 },
    basicPrice: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    freight: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    netPurchaseValue: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, trim: true, index: true },
    poDate: { type: Date, default: Date.now },
    poType: { type: String, trim: true, default: 'Regular' },
    status: { type: String, enum: PO_STATUSES, default: 'DRAFT', index: true },
    supplier: { type: String, trim: true, default: 'VinFast' },
    deliveryLocation: { type: String, trim: true },
    deliveryLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    paymentTerms: { type: String, trim: true, default: 'Advance' },
    fundingBank: { type: String, trim: true },
    requestedDeliveryDate: { type: Date },
    oemCommittedDate: { type: Date },
    expectedDate: { type: Date },
    bookingLinked: { type: Boolean, default: false },
    bookingNumber: { type: String, trim: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    locked: { type: Boolean, default: false },
    approvalHistory: { type: [approvalEntrySchema], default: [] },
    remarks: { type: String, trim: true },
    lines: { type: [poLineSchema], default: [] },
    raisedAt: { type: Date },
    releasedAt: { type: Date },
    closedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
  },
  { timestamps: true },
);

purchaseOrderSchema.pre('save', function computeNet() {
  if (Array.isArray(this.lines)) {
    for (const line of this.lines) {
      line.netPurchaseValue =
        (line.basicPrice || 0) +
        (line.gstAmount || 0) +
        (line.freight || 0) -
        (line.discount || 0);
    }
  }
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
module.exports.PO_STATUSES = PO_STATUSES;
