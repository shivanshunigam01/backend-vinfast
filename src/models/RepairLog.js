const mongoose = require('mongoose');

const repairLogSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDVehicle', required: true, index: true },
    type: {
      type: String,
      enum: ['MAINTENANCE', 'REPAIR', 'INSPECTION', 'OTHER'],
      default: 'MAINTENANCE',
    },
    dueDate: { type: Date },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ['DUE', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'],
      default: 'DUE',
      index: true,
    },
    description: { type: String, trim: true },
    cost: { type: Number },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('RepairLog', repairLogSchema);
