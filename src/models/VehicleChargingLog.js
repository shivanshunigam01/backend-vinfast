const mongoose = require('mongoose');

const vehicleChargingLogSchema = new mongoose.Schema(
  {
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    vin: { type: String, required: true, trim: true, uppercase: true },
    socBefore: { type: Number, min: 0, max: 100 },
    socAfter: { type: Number, min: 0, max: 100 },
    chargedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleChargingLog', vehicleChargingLogSchema);
