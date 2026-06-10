const mongoose = require('mongoose');

const BOOKING_STATUSES = [
  'Pending Approval',
  'Approved',
  'Assigned',
  'Confirmed',
  'In Progress',
  'Completed',
  'Cancelled',
  'No Show',
  'Rescheduled'
];

const TDBookingSchema = new mongoose.Schema({
  bookingRef: { type: String, unique: true },

  // Customer
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName: { type: String, required: true, trim: true },
  customerMobile: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true, lowercase: true },
  drivingLicense: { type: mongoose.Schema.Types.ObjectId, ref: 'DrivingLicense' },
  licenseVerified: { type: Boolean, default: false },

  // Vehicle & Model
  modelRequested: { type: String, enum: ['VF 6', 'VF 7'], required: true },
  variantRequested: { type: String, trim: true },
  assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle' },

  // Slot
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  preferredDate: { type: Date, required: true },
  slotStart: { type: String, required: true }, // HH:MM
  slotEnd: { type: String, required: true },   // HH:MM
  slotDuration: { type: Number },              // minutes

  // Executive
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  executiveAssignedAt: { type: Date },

  // Status
  status: { type: String, enum: BOOKING_STATUSES, default: 'Pending Approval' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: { type: Date },
  cancellationReason: { type: String, trim: true },
  cancelledBy: { type: String, enum: ['Customer', 'Admin', 'System'] },

  // CRM Link
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  leadStageOnBooking: { type: String },

  // UTM
  utmSource: { type: String },
  utmMedium: { type: String },
  utmCampaign: { type: String },

  // Notifications sent
  confirmationSent: { type: Boolean, default: false },
  reminderSent: { type: Boolean, default: false },
  completionNotifSent: { type: Boolean, default: false },

  internalRemarks: { type: String, trim: true }
}, { timestamps: true });

TDBookingSchema.pre('save', function (next) {
  if (!this.bookingRef) {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.bookingRef = `TDB-${ymd}-${rand}`;
  }
  next();
});

module.exports = mongoose.model('TDBooking', TDBookingSchema);
