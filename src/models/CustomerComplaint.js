const mongoose = require('mongoose');

const COMPLAINT_DIRECTIONS = ['INBOUND', 'OUTBOUND'];
const COMPLAINT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const COMPLAINT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const COMPLAINT_CHANNELS = [
  'Phone',
  'WhatsApp',
  'Email',
  'Walk-in',
  'Social Media',
  'Referral',
  'Other',
];

const communicationSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    direction: { type: String, enum: COMPLAINT_DIRECTIONS, required: true },
    note: { type: String, required: true, trim: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    byName: { type: String, trim: true },
  },
  { _id: true },
);

const customerComplaintSchema = new mongoose.Schema(
  {
    complaintNo: { type: String, required: true, unique: true, trim: true, index: true },
    /** INBOUND = customer raised; OUTBOUND = dealership initiated follow-up/call */
    direction: { type: String, enum: COMPLAINT_DIRECTIONS, required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    channel: { type: String, trim: true, default: 'Phone' },
    status: { type: String, enum: COMPLAINT_STATUSES, default: 'OPEN', index: true },
    priority: { type: String, enum: COMPLAINT_PRIORITIES, default: 'MEDIUM', index: true },
    model: { type: String, trim: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', index: true },
    assignedToName: { type: String, trim: true },
    resolution: { type: String, trim: true },
    resolvedAt: { type: Date },
    communications: { type: [communicationSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

customerComplaintSchema.index({ direction: 1, status: 1, createdAt: -1 });
customerComplaintSchema.index({ mobile: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerComplaint', customerComplaintSchema);
module.exports.COMPLAINT_DIRECTIONS = COMPLAINT_DIRECTIONS;
module.exports.COMPLAINT_STATUSES = COMPLAINT_STATUSES;
module.exports.COMPLAINT_PRIORITIES = COMPLAINT_PRIORITIES;
module.exports.COMPLAINT_CHANNELS = COMPLAINT_CHANNELS;
