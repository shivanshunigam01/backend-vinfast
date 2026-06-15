const mongoose = require('mongoose');

const TD_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
  'MISSED',
];

const tdBookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, trim: true, index: true },
    bookingStatus: { type: String, enum: TD_BOOKING_STATUSES, default: 'PENDING' },
    slotDate: { type: Date, required: true, index: true },
    slotTime: { type: String, required: true, trim: true },
    slotDuration: { type: Number, default: 60 },
    dlVerified: { type: Boolean, default: false },
    preferredModel: { type: String, trim: true },
    remarks: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDCustomer' },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDVehicle' },
    assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    testDriveId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestDrive' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TDBooking', tdBookingSchema);
module.exports.TD_BOOKING_STATUSES = TD_BOOKING_STATUSES;
