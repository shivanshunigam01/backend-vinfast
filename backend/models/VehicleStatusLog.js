const mongoose = require('mongoose');

const VehicleStatusLogSchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  fromStatus: { type: String },
  toStatus: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reason: { type: String, trim: true },
  batteryPctAtChange: { type: Number },
  odometerAtChange: { type: Number },
  relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' }
}, { timestamps: true });

module.exports = mongoose.model('VehicleStatusLog', VehicleStatusLogSchema);
