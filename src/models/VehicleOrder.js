const mongoose = require('mongoose');
const { ORDER_STAGES } = require('../constants/stockPipeline');

const milestoneSchema = new mongoose.Schema(
  {
    done: { type: Boolean, default: false },
    doneAt: { type: Date },
    notes: { type: String, trim: true },
    docUrl: { type: String, trim: true },
  },
  { _id: false },
);

const paymentMilestoneSchema = new mongoose.Schema(
  {
    done: { type: Boolean, default: false },
    doneAt: { type: Date },
    notes: { type: String, trim: true },
    docUrl: { type: String, trim: true },
    downPayment: { type: String, trim: true },
    finance: { type: String, trim: true },
    paymentMode: { type: String, trim: true },
  },
  { _id: false },
);

const vehicleOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true, index: true },
    stage: { type: String, enum: ORDER_STAGES, default: 'DRAFT', index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    stockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', index: true },
    customerName: { type: String, trim: true },
    customerMobile: { type: String, trim: true },
    preferredModel: { type: String, trim: true, index: true },
    preferredVariant: { type: String, trim: true },
    preferredColour: { type: String, trim: true },
    bookingNo: { type: String, trim: true },
    vinNo: { type: String, trim: true, uppercase: true },
    motorNo: { type: String, trim: true, uppercase: true },
    motorNo2: { type: String, trim: true, uppercase: true },
    reservationExpiry: { type: Date },
    payment: { type: paymentMilestoneSchema, default: () => ({}) },
    insurance: { type: milestoneSchema, default: () => ({}) },
    registration: { type: milestoneSchema, default: () => ({}) },
    finalPdiPassed: { type: Boolean, default: false },
    retailSaleAt: { type: Date },
    invoicedAt: { type: Date },
    deliveryReadyAt: { type: Date },
    deliveredAt: { type: Date },
    feedbackUrl: { type: String, trim: true },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleOrder', vehicleOrderSchema);
module.exports.ORDER_STAGES = ORDER_STAGES;
