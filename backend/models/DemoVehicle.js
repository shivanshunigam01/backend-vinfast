const mongoose = require('mongoose');

const VEHICLE_STATUSES = ['Available', 'Booked', 'Running', 'Charging', 'Under Repair', 'Battery Low'];

const DemoVehicleSchema = new mongoose.Schema({
  vehicleId: { type: String, unique: true },
  model: { type: String, required: true, enum: ['VF 6', 'VF 7'], trim: true },
  variant: { type: String, required: true, trim: true },
  color: { type: String, trim: true },
  registrationNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  vinNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  chassisNumber: { type: String, trim: true, uppercase: true },
  year: { type: Number, required: true },
  purchaseDate: { type: Date },

  // Real-time status
  status: { type: String, enum: VEHICLE_STATUSES, default: 'Available' },

  // Battery & Charging
  batteryPercentage: { type: Number, default: 100, min: 0, max: 100 },
  chargingStatus: { type: String, enum: ['Not Charging', 'Charging', 'Full'], default: 'Not Charging' },
  estimatedChargingCompleteAt: { type: Date },
  lastChargedAt: { type: Date },
  totalChargingCycles: { type: Number, default: 0 },
  batteryLowThreshold: { type: Number, default: 20 },

  // Odometer
  currentOdometer: { type: Number, default: 0 },
  totalKmDriven: { type: Number, default: 0 },
  dailyKm: { type: Number, default: 0 },
  monthlyKm: { type: Number, default: 0 },
  dailyKmReset: { type: Date },
  monthlyKmReset: { type: Date },

  // Utilization
  totalTestDrives: { type: Number, default: 0 },
  idleTimeMins: { type: Number, default: 0 },
  utilizationRatio: { type: Number, default: 0 },
  depletionThresholdKm: { type: Number, default: 80000 },
  replacementRecommended: { type: Boolean, default: false },

  // Repair
  underRepair: { type: Boolean, default: false },
  repairStartAt: { type: Date },
  estimatedRepairCompleteAt: { type: Date },
  lastServiceAt: { type: Date },

  // Availability
  estimatedAvailableAt: { type: Date },
  assignedBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  currentExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },

  active: { type: Boolean, default: true },
  notes: { type: String, trim: true }
}, { timestamps: true });

DemoVehicleSchema.pre('save', function (next) {
  if (!this.vehicleId) {
    const prefix = this.model === 'VF 7' ? 'VF7' : 'VF6';
    const num = Math.floor(1000 + Math.random() * 9000);
    this.vehicleId = `${prefix}-${num}`;
  }
  // auto set battery low status
  if (this.batteryPercentage <= this.batteryLowThreshold && this.status === 'Available') {
    this.status = 'Battery Low';
  }
  // replacement recommendation
  if (this.totalKmDriven >= this.depletionThresholdKm) {
    this.replacementRecommended = true;
  }
  next();
});

module.exports = mongoose.model('DemoVehicle', DemoVehicleSchema);
