const mongoose = require('mongoose');
const { HOLD_REASONS } = require('../constants/stockPipeline');

const vehicleHoldSchema = new mongoose.Schema(
  {
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    vin: { type: String, required: true, trim: true, uppercase: true },
    holdReason: { type: String, enum: HOLD_REASONS, required: true },
    remarks: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    placedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    placedAt: { type: Date, default: Date.now },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    releasedAt: { type: Date },
    releaseRemarks: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleHold', vehicleHoldSchema);
