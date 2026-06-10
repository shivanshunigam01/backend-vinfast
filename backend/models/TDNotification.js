const mongoose = require('mongoose');

const TDNotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'booking_confirmation',
      'executive_assigned',
      'slot_reminder',
      'reschedule',
      'td_completed',
      'feedback_request',
      'followup_reminder',
      'vehicle_under_repair',
      'vehicle_charging_complete',
      'battery_low_alert',
      'license_verified',
      'license_rejected',
      'booking_approved',
      'booking_cancelled'
    ]
  },
  recipientType: { type: String, enum: ['Customer', 'Executive', 'Manager', 'Admin'], required: true },
  recipient: { type: String, required: true }, // mobile or email
  recipientName: { type: String },

  channel: { type: String, enum: ['SMS', 'WhatsApp', 'Email', 'Push'], required: true },
  subject: { type: String },
  message: { type: String, required: true },

  relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' },
  relatedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle' },
  relatedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

  status: { type: String, enum: ['Queued', 'Sent', 'Failed', 'Delivered'], default: 'Queued' },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  failureReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TDNotification', TDNotificationSchema);
