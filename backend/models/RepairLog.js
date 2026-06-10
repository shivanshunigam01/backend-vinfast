const mongoose = require('mongoose');

const RepairLogSchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  repairType: {
    type: String,
    enum: ['Scheduled Service', 'Breakdown', 'Accident', 'Tyre', 'Battery', 'Software Update', 'Other'],
    required: true
  },
  description: { type: String, trim: true },
  repairStartAt: { type: Date, required: true },
  estimatedCompletionAt: { type: Date },
  actualCompletionAt: { type: Date },
  serviceCenter: { type: String, trim: true },
  technician: { type: String, trim: true },
  odometerAtRepair: { type: Number },
  cost: { type: Number },
  status: { type: String, enum: ['Open', 'In Progress', 'Completed'], default: 'Open' },
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  notes: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('RepairLog', RepairLogSchema);
