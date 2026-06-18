const mongoose = require('mongoose');
const TDStaff = require('../models/TDStaff');
const Lead = require('../models/Lead');

function toObjectId(id) {
  if (id == null) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : '';
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
 * All TDStaff ids that represent this logged-in user (handles duplicate legacy accounts).
 */
async function resolveStaffIdsForUser(admin) {
  const ids = new Set();
  if (admin?._id) ids.add(String(admin._id));

  const email = normalizeEmail(admin?.email);
  if (email) {
    const rows = await TDStaff.find({ email }).select('_id').lean();
    for (const row of rows) ids.add(String(row._id));
  }

  return [...ids];
}

function assignedToIdsFilter(staffIds, staffEmail) {
  const or = [];
  for (const rawId of staffIds) {
    const idStr = String(rawId);
    const oid = toObjectId(rawId);
    if (oid) {
      or.push({ assignedTo: oid }, { assignedTo: idStr });
    } else {
      or.push({ assignedTo: idStr });
    }
  }
  const email = normalizeEmail(staffEmail);
  if (email) or.push({ assignedToEmail: email });
  if (!or.length) return { assignedTo: null };
  return { $or: or };
}

/**
 * Mongo filter for leads assigned to a TDStaff user (by id and email).
 */
function assignedToStaffFilter(staffId, staffEmail) {
  return assignedToIdsFilter(staffId ? [String(staffId)] : [], staffEmail);
}

async function assignedToStaffFilterAsync(admin) {
  const staffIds = await resolveStaffIdsForUser(admin);
  return assignedToIdsFilter(staffIds, admin?.email);
}

function leadAssignedToStaff(lead, staffId, staffEmail) {
  const assigned = lead?.assignedTo?._id || lead?.assignedTo;
  const email = normalizeEmail(staffEmail);
  if (email && normalizeEmail(lead?.assignedToEmail) === email) return true;
  if (assigned && staffId && String(assigned) === String(staffId)) return true;
  if (email && lead?.assignedTo?.email && normalizeEmail(lead.assignedTo.email) === email) return true;
  return false;
}

function applyLeadAssignment(lead, assignee) {
  if (assignee) {
    lead.assignedTo = toObjectId(assignee._id) || assignee._id;
    lead.assignedToEmail = normalizeEmail(assignee.email);
  } else {
    lead.assignedTo = undefined;
    lead.assignedToEmail = undefined;
  }
}

/** Backfill assignedToEmail for leads already assigned to this executive. */
async function repairExecutiveLeadAssignments(admin) {
  const email = normalizeEmail(admin?.email);
  if (!email) return;

  const staffIds = await resolveStaffIdsForUser(admin);
  const idOr = [];
  for (const rawId of staffIds) {
    const oid = toObjectId(rawId);
    if (oid) idOr.push({ assignedTo: oid }, { assignedTo: String(rawId) });
    else idOr.push({ assignedTo: String(rawId) });
  }
  if (!idOr.length) return;

  const primaryId = toObjectId(admin._id) || admin._id;

  await Lead.updateMany(
    { $or: [...idOr, { assignedToEmail: email }] },
    { $set: { assignedToEmail: email, assignedTo: primaryId } },
  );
}

module.exports = {
  toObjectId,
  normalizeEmail,
  isExecutiveScopedUser,
  resolveStaffIdsForUser,
  assignedToStaffFilter,
  assignedToStaffFilterAsync,
  assignedToIdsFilter,
  leadAssignedToStaff,
  applyLeadAssignment,
  repairExecutiveLeadAssignments,
};
