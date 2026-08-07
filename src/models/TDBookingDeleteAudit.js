const mongoose = require('mongoose');

const DELETE_MODES = ['single', 'bulk', 'script'];

const deletedBookingSnapshotSchema = new mongoose.Schema(
  {
    bookingObjectId: { type: mongoose.Schema.Types.ObjectId },
    bookingCode: { type: String, trim: true },
    bookingStatus: { type: String, trim: true },
    customerName: { type: String, trim: true },
    customerMobile: { type: String, trim: true },
    slotDate: { type: Date },
    slotTime: { type: String, trim: true },
    preferredModel: { type: String, trim: true },
    testDriveId: { type: mongoose.Schema.Types.ObjectId },
    assignedExecutive: { type: mongoose.Schema.Types.ObjectId },
  },
  { _id: false },
);

/**
 * Immutable audit trail for permanent TD booking deletes.
 * Survives even after the booking row itself is gone.
 */
const tdBookingDeleteAuditSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: DELETE_MODES, required: true, index: true },
    deletedCount: { type: Number, required: true, min: 0 },
    requestedCount: { type: Number, min: 0 },
    skippedInProgress: [{ type: String, trim: true }],
    bookings: { type: [deletedBookingSnapshotSchema], default: [] },
    deletedById: { type: mongoose.Schema.Types.ObjectId, index: true },
    deletedByName: { type: String, trim: true },
    deletedByEmail: { type: String, trim: true, lowercase: true, index: true },
    deletedByRole: { type: String, trim: true },
    deletedByDesignation: { type: String, trim: true },
    deletedByUserType: { type: String, trim: true }, // admin | tdstaff | system
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

tdBookingDeleteAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TDBookingDeleteAudit', tdBookingDeleteAuditSchema);
module.exports.DELETE_MODES = DELETE_MODES;
