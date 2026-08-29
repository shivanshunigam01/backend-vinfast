const mongoose = require('mongoose');
const { RECTIFICATION_STATUSES } = require('../constants/stockPipeline');

const rectificationSchema = new mongoose.Schema(
  {
    rectificationNo: { type: String, required: true, unique: true, trim: true, index: true },
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    vin: { type: String, required: true, trim: true, uppercase: true },
    source: { type: String, trim: true },
    issueCategory: { type: String, trim: true },
    severity: { type: String, enum: ['MINOR', 'MAJOR', 'CRITICAL'], default: 'MINOR' },
    issueDescription: { type: String, required: true, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    oemClaimRequired: { type: Boolean, default: false },
    claimReference: { type: String, trim: true },
    actionTaken: { type: String, trim: true },
    completionDate: { type: Date },
    rePdiRequired: { type: Boolean, default: true },
    status: { type: String, enum: RECTIFICATION_STATUSES, default: 'OPEN', index: true },
    sourceEntityType: { type: String, trim: true },
    sourceEntityId: { type: mongoose.Schema.Types.ObjectId },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Rectification', rectificationSchema);
