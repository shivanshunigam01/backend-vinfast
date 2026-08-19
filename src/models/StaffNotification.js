const mongoose = require('mongoose');

const PRIORITIES = ['urgent', 'today', 'info', 'done'];

const staffNotificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    type: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    customerName: { type: String, trim: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    href: { type: String, trim: true },
    priority: { type: String, enum: PRIORITIES, default: 'info', index: true },
    readAt: { type: Date, default: null, index: true },
    dedupeKey: { type: String, trim: true, sparse: true },
  },
  { timestamps: true },
);

staffNotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
staffNotificationSchema.index({ recipientId: 1, createdAt: -1 });
staffNotificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('StaffNotification', staffNotificationSchema);
module.exports.PRIORITIES = PRIORITIES;
