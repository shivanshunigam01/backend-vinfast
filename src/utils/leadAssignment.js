const mongoose = require('mongoose');

function toObjectId(id) {
  if (id == null) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/** Field executives (not managers/superadmins) only see their own assigned leads. */
function isExecutiveScopedUser(admin) {
  if (!admin) return false;
  if (['manager', 'superadmin'].includes(admin.role) && admin.designation !== 'sales_executive') {
    return false;
  }
  return admin.role === 'executive' || admin.designation === 'sales_executive';
}

/**
 * Mongo filter for leads assigned to a TDStaff user.
 * Matches ObjectId and legacy string-stored assignedTo values.
 */
function assignedToStaffFilter(staffId) {
  const idStr = String(staffId);
  const oid = toObjectId(staffId);
  if (!oid) return { assignedTo: idStr };
  return {
    $or: [{ assignedTo: oid }, { assignedTo: idStr }],
  };
}

function leadAssignedToStaff(lead, staffId) {
  const assigned = lead?.assignedTo?._id || lead?.assignedTo;
  if (!assigned || !staffId) return false;
  return String(assigned) === String(staffId);
}

module.exports = {
  toObjectId,
  isExecutiveScopedUser,
  assignedToStaffFilter,
  leadAssignedToStaff,
};
