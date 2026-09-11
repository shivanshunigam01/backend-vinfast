const mongoose = require('mongoose');

const REQUISITION_PRIORITIES = ['NORMAL', 'URGENT'];
const REQUISITION_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'CLOSED', 'CANCELLED'];

const stockRequisitionSchema = new mongoose.Schema(
  {
    requisitionNo: { type: String, required: true, unique: true, trim: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', required: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    variant: { type: String, trim: true },
    colour: { type: String, trim: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
    priority: { type: String, enum: REQUISITION_PRIORITIES, default: 'NORMAL', index: true },
    neededBy: { type: Date },
    status: { type: String, enum: REQUISITION_STATUSES, default: 'DRAFT', index: true },
    remarks: { type: String, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch', index: true },
    linkedPoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

stockRequisitionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('StockRequisition', stockRequisitionSchema);
module.exports.REQUISITION_PRIORITIES = REQUISITION_PRIORITIES;
module.exports.REQUISITION_STATUSES = REQUISITION_STATUSES;
