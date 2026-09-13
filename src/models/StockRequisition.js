const mongoose = require('mongoose');

const REQUISITION_PRIORITIES = ['NORMAL', 'URGENT'];
const REQUISITION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_MD',
  'APPROVED',
  'PART_ORDERED',
  'ORDERED',
  'RETURNED',
  'REJECTED',
  'CLOSED',
  'CANCELLED',
];

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

const stockRequisitionSchema = new mongoose.Schema(
  {
    requisitionNo: { type: String, required: true, unique: true, trim: true, index: true },
    version: { type: Number, default: 1, min: 1 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', required: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    variant: { type: String, trim: true },
    colour: { type: String, trim: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
    orderedQty: { type: Number, default: 0, min: 0 },
    priority: { type: String, enum: REQUISITION_PRIORITIES, default: 'NORMAL', index: true },
    neededBy: { type: Date },
    receivingLocation: { type: String, trim: true },
    purpose: { type: String, trim: true },
    justification: { type: String, trim: true },
    indicativeAmount: { type: Number, min: 0 },
    status: { type: String, enum: REQUISITION_STATUSES, default: 'DRAFT', index: true },
    remarks: { type: String, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch', index: true },
    linkedPoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    linkedPoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }],
    planReference: { type: String, trim: true },
    submittedAt: { type: Date },
    recommendedAt: { type: Date },
    recommendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    approvalHistory: { type: [approvalEntrySchema], default: [] },
  },
  { timestamps: true },
);

stockRequisitionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('StockRequisition', stockRequisitionSchema);
module.exports.REQUISITION_PRIORITIES = REQUISITION_PRIORITIES;
module.exports.REQUISITION_STATUSES = REQUISITION_STATUSES;
