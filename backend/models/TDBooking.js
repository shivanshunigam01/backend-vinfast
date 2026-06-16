const mongoose = require('mongoose');

const TDBookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  slotDate: { type: Date, required: true },
  slotTime: { type: String, required: true },
  slotDuration: { type: Number, enum: [30, 45, 60], default: 60 },
  bookingStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'MISSED'],
    default: 'PENDING'
  },
  dlVerified: { type: Boolean, default: false },
  preferredModel: { type: String, enum: ['VF 6', 'VF 7', ''], default: '' },
  preferredVariant: { type: String, trim: true, default: '' },
  confirmationSentAt: { type: Date },
  reminderSentAt: { type: Date },
  cancellationReason: { type: String, trim: true },
  rescheduleCount: { type: Number, default: 0 },
  remarks: { type: String, trim: true },
  testDriveId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestDrive', unique: true, sparse: true }
}, { timestamps: true });

TDBookingSchema.pre('save', async function (next) {
  if (this.bookingId) return next();
  const count = await mongoose.model('TDBooking').countDocuments();
  const year = new Date().getFullYear();
  this.bookingId = `TDBK-${year}-${String(count + 1).padStart(5, '0')}`;
  next();
});

module.exports = mongoose.model('TDBooking', TDBookingSchema);
