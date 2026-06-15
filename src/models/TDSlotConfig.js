const mongoose = require('mongoose');

const tdSlotConfigSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch', required: true, unique: true },
    slotDuration: { type: Number, default: 60 },
    bufferTime: { type: Number, default: 15 },
    workingStartTime: { type: String, default: '09:00' },
    workingEndTime: { type: String, default: '18:00' },
    maxConcurrentBookings: { type: Number, default: 2 },
    autoExpiry: { type: Boolean, default: true },
    blockedDates: [{ type: String, trim: true }],
    slotTimes: [{ type: String, trim: true }],
    disabledSlotsByDate: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TDSlotConfig', tdSlotConfigSchema);
