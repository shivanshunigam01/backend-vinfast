const mongoose = require('mongoose');

const tdNotificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ['CUSTOMER', 'EXECUTIVE', 'ADMIN', 'STAFF'],
      required: true,
    },
    recipientId: { type: String, trim: true },
    recipientContact: { type: String, trim: true },
    channel: { type: String, enum: ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP'], required: true },
    templateKey: { type: String, required: true, trim: true },
    subject: { type: String, trim: true },
    message: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    error: { type: String, trim: true },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

tdNotificationSchema.index({ createdAt: -1 });
tdNotificationSchema.index({ bookingId: 1, templateKey: 1 });

module.exports = mongoose.model('TDNotification', tdNotificationSchema);
