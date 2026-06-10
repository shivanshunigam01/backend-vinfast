const mongoose = require('mongoose');

const ChargingLogSchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date },
  startingBatteryPct: { type: Number, required: true },
  endingBatteryPct: { type: Number },
  chargerType: { type: String, enum: ['AC Home', 'AC Public', 'DC Fast', 'DC Ultra-Fast'], default: 'AC Home' },
  chargerLocation: { type: String, trim: true },
  energyConsumedKwh: { type: Number },
  durationMins: { type: Number },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  notes: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('ChargingLog', ChargingLogSchema);
