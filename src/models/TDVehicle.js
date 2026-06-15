const mongoose = require('mongoose');

const tdVehicleSchema = new mongoose.Schema(
  {
    vehicleId: { type: String, trim: true, index: true },
    model: { type: String, required: true, trim: true },
    variant: { type: String, trim: true },
    registrationNo: { type: String, trim: true },
    vinNo: { type: String, trim: true },
    color: { type: String, trim: true },
    batteryPercent: { type: Number, default: 100 },
    currentOdometer: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['AVAILABLE', 'BOOKED', 'RUNNING', 'CHARGING', 'REPAIR', 'BATTERY_LOW', 'SERVICE_DUE'],
      default: 'AVAILABLE',
    },
    totalTestDriveKM: { type: Number, default: 0 },
    totalTestDrives: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    insuranceValidity: { type: Date },
    serviceDueDate: { type: Date },
    availableAgainAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TDVehicle', tdVehicleSchema);
