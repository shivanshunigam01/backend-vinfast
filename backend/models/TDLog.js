const mongoose = require('mongoose');

const CheckpointSchema = new mongoose.Schema({
  capturedAt: { type: Date },
  capturedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  value: { type: mongoose.Schema.Types.Mixed },
  note: { type: String }
}, { _id: false });

const GeoPointSchema = new mongoose.Schema({
  lat: { type: Number },
  lng: { type: Number },
  capturedAt: { type: Date, default: Date.now }
}, { _id: false });

const TDLogSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking', required: true, unique: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  executive: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  // Pre-drive checkpoints
  customerConfirmed: { type: Boolean, default: false },
  licenseChecked: { type: Boolean, default: false },

  startedAt: { type: Date },
  completedAt: { type: Date },
  durationMins: { type: Number },

  // Odometer
  openingOdometer: CheckpointSchema,
  closingOdometer: CheckpointSchema,
  distanceDriven: { type: Number }, // km

  // Battery
  openingBatteryPct: CheckpointSchema,
  closingBatteryPct: CheckpointSchema,
  batteryUsedPct: { type: Number },

  // GPS
  startLocation: GeoPointSchema,
  endLocation: GeoPointSchema,
  routePoints: [GeoPointSchema],
  maxSpeedKmh: { type: Number },

  // Post-drive
  executiveRemarks: { type: String, trim: true },
  customerMood: { type: String, enum: ['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'] },
  buyingIntent: { type: String, enum: ['Hot', 'Warm', 'Cold', 'Not Interested'] },

  // Lead follow-up
  nextFollowUpDate: { type: Date },
  leadStageUpdatedTo: { type: String },
  leadStageUpdatedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('TDLog', TDLogSchema);
