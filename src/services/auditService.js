const AuditLog = require('../models/AuditLog');

async function logAudit({
  entityType,
  entityId,
  action,
  field,
  oldValue,
  newValue,
  remarks,
  userId,
  userName,
  metadata,
}) {
  return AuditLog.create({
    entityType,
    entityId,
    action,
    field,
    oldValue,
    newValue,
    remarks,
    userId,
    userName,
    metadata,
  });
}

async function logStatusChange(entityType, entityId, fromStatus, toStatus, admin, remarks) {
  return logAudit({
    entityType,
    entityId,
    action: 'STATUS_CHANGE',
    field: 'status',
    oldValue: fromStatus,
    newValue: toStatus,
    remarks,
    userId: admin?._id,
    userName: admin?.name || admin?.email,
  });
}

async function listAuditLogs(entityType, entityId, limit = 100) {
  return AuditLog.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = { logAudit, logStatusChange, listAuditLogs };
