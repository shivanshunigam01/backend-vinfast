const mongoose = require('mongoose');

const PREFERRED_SLOT_SCHEMA = new mongoose.Schema(
  {
    slotDate: { type: Date, required: true },
    slotTime: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const TD_RESCHEDULE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

/**
 * Customer submits 3 preferred slots; dealership assigns one.
 * Full audit trail for reschedule history reports.
 */
const tdRescheduleRequestSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TDBooking',
      required: true,
      index: true,
    },
    bookingCode: { type: String, trim: true, index: true },
    status: { type: String, enum: TD_RESCHEDULE_STATUSES, default: 'PENDING', index: true },
    originalSlot: {
      slotDate: { type: Date },
      slotTime: { type: String, trim: true },
    },
    preferredSlots: {
      type: [PREFERRED_SLOT_SCHEMA],
      validate: {
        validator(v) {
          if (!Array.isArray(v) || v.length !== 3) return false;
          const keys = new Set(
            v.map((slot) => {
              const date = new Date(slot.slotDate);
              const dateKey = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
              return `${dateKey}|${String(slot.slotTime || '').trim()}`;
            }),
          );
          return keys.size === 3;
        },
        message: 'Exactly 3 different preferred date/time options are required',
      },
    },
    approvedSlot: {
      slotDate: { type: Date },
      slotTime: { type: String, trim: true },
    },
    reason: { type: String, trim: true },
    adminNote: { type: String, trim: true },
    requestedByCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'TDCustomer' },
    requestedByStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    requestedByName: { type: String, trim: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    approvedByName: { type: String, trim: true },
    decidedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TDRescheduleRequest', tdRescheduleRequestSchema);
module.exports.TD_RESCHEDULE_STATUSES = TD_RESCHEDULE_STATUSES;
