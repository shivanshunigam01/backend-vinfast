const mongoose = require('mongoose');
const TDStaff = require('../models/TDStaff');
const Lead = require('../models/Lead');

/** Designations that see the full dealership (not limited to reporting tree). */
const UNRESTRICTED_DESIGNATIONS = new Set(['md', 'ceo', 'gm']);

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

function touchLeadActivity(lead, at = new Date()) {
  if (!lead) return;
  lead.lastActivityAt = at;
}

/** CRM list sort — recently assigned/edited leads first. */
const CRM_LEAD_LIST_SORT = { lastActivityAt: -1, updatedAt: -1, createdAt: -1, _id: -1 };

/**
 * MD / CEO / GM / superadmin see all records.
 * Sales Head, Sales Managers, Branch Managers, Executives are limited to their
 * org subtree (self + everyone who reports up to them via reportsTo).
 */
function isUnrestrictedViewer(admin) {
  if (!admin) return false;
  if (admin.role === 'superadmin') return true;
  const designation = String(admin.designation || '').toLowerCase();
  return UNRESTRICTED_DESIGNATIONS.has(designation);
}

/** Field executives (leaf) — only their own assignments (subset of team scope). */
function isExecutiveScopedUser(admin) {
  if (!admin) return false;
  if (isUnrestrictedViewer(admin)) return false;
  if (['manager', 'superadmin'].includes(admin.role) && admin.designation !== 'sales_executive') {
    return false;
  }
  return admin.role === 'executive' || admin.designation === 'sales_executive';
}

/**
 * Anyone who is not unrestricted must filter by assignment to self + subordinates.
 * Covers SE (own only), SM (team), SH/BM (their tree).
 */
function isTeamScopedUser(admin) {
  if (!admin) return false;
  return !isUnrestrictedViewer(admin);
}

/**
 * Collect staff ids in the reporting subtree rooted at `rootId`
 * (everyone whose reportsTo chain leads to rootId, plus rootId).
 */
async function collectSubtreeStaffIds(rootId) {
  const root = String(rootId);
  const ids = new Set([root]);
  const all = await TDStaff.find({ active: { $ne: false } })
    .select('_id reportsTo')
    .lean();

  // Build children map: managerId → [direct reports]
  const children = new Map();
  for (const row of all) {
    if (!row.reportsTo) continue;
    const parent = String(row.reportsTo);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(String(row._id));
  }

  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    const kids = children.get(cur) || [];
    for (const kid of kids) {
      if (ids.has(kid)) continue;
      ids.add(kid);
      stack.push(kid);
    }
  }

  return [...ids];
}

/**
 * Resolve which staff IDs this user may view assignments for.
 * - Unrestricted: caller should not use this filter (sees all)
 * - Team-scoped: self + all descendants via reportsTo
 * - Also merges duplicate TDStaff rows sharing the same email
 */
async function resolveStaffIdsForUser(admin) {
  const ids = new Set();
  if (admin?._id) ids.add(String(admin._id));

  const email = normalizeEmail(admin?.email);
  if (email) {
    const rows = await TDStaff.find({ email }).select('_id').lean();
    for (const row of rows) ids.add(String(row._id));
  }

  // Expand to reporting subtree for managers / heads (SE has no children → unchanged).
  if (isTeamScopedUser(admin) && !isExecutiveScopedUser(admin)) {
    const roots = [...ids];
    for (const rootId of roots) {
      const subtree = await collectSubtreeStaffIds(rootId);
      for (const id of subtree) ids.add(id);
    }
  } else if (isExecutiveScopedUser(admin)) {
    // Leaf executives: own ids only (already in set).
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
  // Only match email for single-person scope (executive). Team scope uses ids.
  if (email && staffIds.length <= 2) or.push({ assignedToEmail: email });
  if (!or.length) return { assignedTo: null };
  return { $or: or };
}

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

async function leadReadableByAdmin(lead, admin) {
  if (!isTeamScopedUser(admin)) return true;
  const staffIds = await resolveStaffIdsForUser(admin);
  const assigned = lead?.assignedTo?._id || lead?.assignedTo;
  if (assigned && staffIds.includes(String(assigned))) return true;
  const email = normalizeEmail(admin?.email);
  if (email && normalizeEmail(lead?.assignedToEmail) === email) return true;
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
    {
      $and: [
        { $or: idOr },
        {
          $or: [
            { assignedToEmail: { $exists: false } },
            { assignedToEmail: null },
            { assignedToEmail: '' },
          ],
        },
      ],
    },
    { $set: { assignedToEmail: email, assignedTo: primaryId } },
    { timestamps: false },
  );
}

function assignedExecutiveIdsFilter(staffIds, staffEmail) {
  const or = [];
  for (const rawId of staffIds) {
    const idStr = String(rawId);
    const oid = toObjectId(rawId);
    if (oid) {
      or.push({ assignedExecutive: oid }, { assignedExecutive: idStr });
    } else {
      or.push({ assignedExecutive: idStr });
    }
  }
  const email = normalizeEmail(staffEmail);
  if (email && staffIds.length <= 2) or.push({ assignedExecutiveEmail: email });
  if (!or.length) return { assignedExecutive: null };
  return { $or: or };
}

async function assignedExecutiveFilterAsync(admin) {
  const staffIds = await resolveStaffIdsForUser(admin);
  return assignedExecutiveIdsFilter(staffIds, admin?.email);
}

function bookingAssignedToStaff(booking, staffId, staffEmail) {
  const assigned = booking?.assignedExecutive?._id || booking?.assignedExecutive;
  const email = normalizeEmail(staffEmail);
  if (email && normalizeEmail(booking?.assignedExecutiveEmail) === email) return true;
  if (assigned && staffId && String(assigned) === String(staffId)) return true;
  if (email && booking?.assignedExecutive?.email && normalizeEmail(booking.assignedExecutive.email) === email) {
    return true;
  }
  return false;
}

function applyBookingExecutiveAssignment(booking, staff) {
  if (staff) {
    booking.assignedExecutive = toObjectId(staff._id) || staff._id;
    booking.assignedExecutiveEmail = normalizeEmail(staff.email);
  } else {
    booking.assignedExecutive = undefined;
    booking.assignedExecutiveEmail = undefined;
  }
}

/** Backfill missing assignedExecutiveEmail on TD bookings for this executive. */
async function repairExecutiveBookingAssignments(admin) {
  const email = normalizeEmail(admin?.email);
  if (!email) return;

  const staffIds = await resolveStaffIdsForUser(admin);
  const idOr = [];
  for (const rawId of staffIds) {
    const oid = toObjectId(rawId);
    if (oid) idOr.push({ assignedExecutive: oid }, { assignedExecutive: String(rawId) });
    else idOr.push({ assignedExecutive: String(rawId) });
  }
  if (!idOr.length) return;

  const primaryId = toObjectId(admin._id) || admin._id;
  const TDBooking = require('../models/TDBooking');

  await TDBooking.updateMany(
    {
      $and: [
        { $or: idOr },
        {
          $or: [
            { assignedExecutiveEmail: { $exists: false } },
            { assignedExecutiveEmail: null },
            { assignedExecutiveEmail: '' },
          ],
        },
      ],
    },
    { $set: { assignedExecutiveEmail: email, assignedExecutive: primaryId } },
    { timestamps: false },
  );
}

module.exports = {
  toObjectId,
  normalizeEmail,
  touchLeadActivity,
  CRM_LEAD_LIST_SORT,
  UNRESTRICTED_DESIGNATIONS,
  isUnrestrictedViewer,
  isExecutiveScopedUser,
  isTeamScopedUser,
  collectSubtreeStaffIds,
  resolveStaffIdsForUser,
  assignedToStaffFilter,
  assignedToStaffFilterAsync,
  assignedToIdsFilter,
  leadAssignedToStaff,
  leadReadableByAdmin,
  applyLeadAssignment,
  repairExecutiveLeadAssignments,
  assignedExecutiveFilterAsync,
  bookingAssignedToStaff,
  applyBookingExecutiveAssignment,
  repairExecutiveBookingAssignments,
};
