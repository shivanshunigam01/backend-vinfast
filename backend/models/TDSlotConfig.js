const mongoose = require('mongoose');

const TDSlotConfigSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  slotDuration: { type: Number, enum: [30, 45, 60], default: 30 },
  bufferTime: { type: Number, default: 15 },
  workingStartTime: { type: String, default: '10:00' },
  workingEndTime: { type: String, default: '18:00' },
  maxConcurrentBookings: { type: Number, default: 2 },
  autoExpiry: { type: Boolean, default: true },
  blockedDates: [{ type: String }],
  /** Admin-managed bookable times (HH:MM). Shown on website exactly as configured. */
  slotTimes: [{ type: String, trim: true }],
  /** Per-date admin-disabled slots: { "2026-06-17": ["12:00"] } */
  disabledSlotsByDate: {
    type: Map,
    of: [String],
    default: () => new Map()
  },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('TDSlotConfig', TDSlotConfigSchema);
