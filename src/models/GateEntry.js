const mongoose = require('mongoose');

const gateEntrySchema = new mongoose.Schema(
  {
    gateEntryNo: { type: String, required: true, unique: true, trim: true, index: true },
    dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch', required: true, index: true },
    arrivalDatetime: { type: Date, required: true },
    truckNumber: { type: String, required: true, trim: true },
    sealNumber: { type: String, trim: true },
    sealCondition: { type: String, enum: ['OK', 'BROKEN', 'N/A'], default: 'OK' },
    sealRemark: { type: String, trim: true },
    arrivalPhotoUrl: { type: String, trim: true },
    arrivalPhotoPublicId: { type: String, trim: true },
    status: { type: String, enum: ['ARRIVED', 'GRN_IN_PROGRESS', 'CLOSED'], default: 'ARRIVED' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    remarks: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('GateEntry', gateEntrySchema);
