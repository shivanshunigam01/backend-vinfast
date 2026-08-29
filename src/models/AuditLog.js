const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, trim: true },
    field: { type: String, trim: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    remarks: { type: String, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', index: true },
    userName: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
