const mongoose = require('mongoose');

// A slot represents a bookable time window on a given date for a vehicle
const TDSlotConfigSchema = new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  slotDuration: { type: Number, default: 45, min: 30, max: 60 },   // minutes
  bufferTime: { type: Number, default: 15, min: 0, max: 30 },       // minutes between slots
  startTime: { type: String, default: '09:00' },                    // HH:MM
  endTime: { type: String, default: '18:00' },
  maxConcurrentBookings: { type: Number, default: 1 },              // per vehicle
  advanceBookingDays: { type: Number, default: 7 },                 // max days ahead
  activeWeekdays: {
    monday: { type: Boolean, default: true },
    tuesday: { type: Boolean, default: true },
    wednesday: { type: Boolean, default: true },
    thursday: { type: Boolean, default: true },
    friday: { type: Boolean, default: true },
    saturday: { type: Boolean, default: true },
    sunday: { type: Boolean, default: false }
  }
}, { timestamps: true });

module.exports = mongoose.model('TDSlotConfig', TDSlotConfigSchema);
