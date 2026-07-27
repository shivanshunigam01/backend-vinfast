const mongoose = require('mongoose');

const chargingLogSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDVehicle', required: true, index: true },
    scheduledAt: { type: Date, required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
    batteryBefore: { type: Number, min: 0, max: 100 },
    batteryAfter: { type: Number, min: 0, max: 100 },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ChargingLog', chargingLogSchema);
