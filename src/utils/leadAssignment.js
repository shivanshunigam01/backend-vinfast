const mongoose = require('mongoose');
const TDStaff = require('../models/TDStaff');
const Lead = require('../models/Lead');

/** Designations that see the full dealership (not limited to reporting tree). */
const UNRESTRICTED_DESIGNATIONS = new Set(['md', 'ceo', 'gm', 'cre']);

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

/** Designations that CRE may assign leads / TD bookings to. */
const CRE_ASSIGNABLE_DESIGNATIONS = new Set(['sales_executive', 'sales_manager']);

function isCreUser(admin) {
  return String(admin?.designation || '').toLowerCase() === 'cre';
}

function isCreAssignableDesignation(designation) {
  const d = String(designation || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (CRE_ASSIGNABLE_DESIGNATIONS.has(d)) return true;
  // Custom User Master labels e.g. "Sales Manager"
  if (d === 'sales_manager' || d.includes('sales_manager')) return true;
  if (d === 'sales_executive' || d.includes('sales_executive')) return true;
  return false;
}

function touchLeadActivity(lead, at = new Date()) {
  if (!lead) return;
  lead.lastActivityAt = at;
}

/** CRM list sort — newest created leads first (date + time), then recent activity. */
const CRM_LEAD_LIST_SORT = { createdAt: -1, lastActivityAt: -1, updatedAt: -1, _id: -1 };

/**
 * Admin portal, MD / CEO / GM / CRE / superadmin see all records.
 * Sales Head, Sales Managers, Branch Managers, Executives are limited to their
 * org subtree (self + everyone who reports up to them via reportsTo).
 */
function resolveReportsScope(admin) {
  const explicit = String(admin?.reportsScope || '').trim().toLowerCase();
  if (explicit === 'organisation' || explicit === 'team' || explicit === 'self') return explicit;
  if (admin?.userType === 'admin' || admin?.role === 'superadmin') return 'organisation';
  const designation = String(admin?.designation || '').toLowerCase();
  if (['gm', 'ceo', 'md', 'sales_head', 'cre'].includes(designation)) return 'organisation';
  if (['sales_manager', 'branch_manager'].includes(designation)) return 'team';
  return 'self';
}

function isOrganisationScopedUser(admin) {
  return resolveReportsScope(admin) === 'organisation';
}

function isUnrestrictedViewer(admin) {
  if (!admin) return false;
  // Admin-collection logins are not in the TDStaff reporting tree — never team-scope them.
  if (admin.userType === 'admin') return true;
  if (admin.role === 'superadmin') return true;
  if (isCreUser(admin)) return true;
  if (isOrganisationScopedUser(admin)) return true;
  const designation = String(admin.designation || '').toLowerCase();
  return UNRESTRICTED_DESIGNATIONS.has(designation);
}

/** Field executives (leaf) — only their own assignments (subset of team scope). */
function isExecutiveScopedUser(admin) {
  if (!admin) return false;
  if (isUnrestrictedViewer(admin)) return false;
  if (isCreUser(admin)) return false;
  const designation = String(admin.designation || '').toLowerCase();
  // Org managers / heads are never leaf-executive scoped (even if role was mis-set).
  if (['sales_manager', 'sales_head', 'branch_manager', 'gm', 'ceo', 'md'].includes(designation)) {
    return false;
  }
  if (['manager', 'superadmin'].includes(admin.role) && designation !== 'sales_executive') {
    return false;
  }
  return admin.role === 'executive' || designation === 'sales_executive';
}

/**
 * Staff IDs that are "this person" only (login id + duplicate TDStaff rows by email).
 * Does NOT include reporting subordinates.
 */
async function resolveSelfStaffIds(admin) {
  const ids = new Set();
  if (admin?._id) ids.add(String(admin._id));
  const email = normalizeEmail(admin?.email);
  if (email) {
    const rows = await TDStaff.find({ email }).select('_id').lean();
    for (const row of rows) ids.add(String(row._id));
  }
  return [...ids];
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

function assignedToIdsFilter(staffIds, staffEmail, extraEmails = []) {
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
  const emails = new Set();
  const primary = normalizeEmail(staffEmail);
  if (primary) emails.add(primary);
  for (const e of extraEmails || []) {
    const n = normalizeEmail(e);
    if (n) emails.add(n);
  }
  // Always match by email so SM/team lists still work when assignee id is stale/mismatched.
  for (const email of emails) {
    or.push({ assignedToEmail: email });
  }
  if (!or.length) return { assignedTo: null };
  return { $or: or };
}

function assignedToStaffFilter(staffId, staffEmail) {
  return assignedToIdsFilter(staffId ? [String(staffId)] : [], staffEmail);
}

async function resolveStaffEmailsForIds(staffIds, viewerEmail) {
  const emails = new Set();
  const primary = normalizeEmail(viewerEmail);
  if (primary) emails.add(primary);

  const oids = (staffIds || []).map((id) => toObjectId(id)).filter(Boolean);
  if (oids.length) {
    const rows = await TDStaff.find({ _id: { $in: oids } }).select('email').lean();
    for (const row of rows) {
      const e = normalizeEmail(row.email);
      if (e) emails.add(e);
    }
  }
  return [...emails];
}

async function assignedToStaffFilterAsync(admin) {
  const staffIds = await resolveStaffIdsForUser(admin);
  const emails = await resolveStaffEmailsForIds(staffIds, admin?.email);
  return assignedToIdsFilter(staffIds, admin?.email, emails);
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
  const leadEmail = normalizeEmail(lead?.assignedToEmail);
  if (!leadEmail) return false;
  const teamEmails = await resolveStaffEmailsForIds(staffIds, admin?.email);
  return teamEmails.includes(leadEmail);
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

  // Self only — never rewrite team members' leads onto the viewer (breaks SM dashboards).
  const staffIds = await resolveSelfStaffIds(admin);
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

function assignedExecutiveIdsFilter(staffIds, staffEmail, extraEmails = []) {
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
  const emails = new Set();
  const primary = normalizeEmail(staffEmail);
  if (primary) emails.add(primary);
  for (const e of extraEmails || []) {
    const n = normalizeEmail(e);
    if (n) emails.add(n);
  }
  for (const email of emails) {
    or.push({ assignedExecutiveEmail: email });
  }
  if (!or.length) return { assignedExecutive: null };
  return { $or: or };
}

async function assignedExecutiveFilterAsync(admin) {
  const staffIds = await resolveStaffIdsForUser(admin);
  const emails = await resolveStaffEmailsForIds(staffIds, admin?.email);
  return assignedExecutiveIdsFilter(staffIds, admin?.email, emails);
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

/** Backfill missing assignedExecutiveEmail on TD bookings for this executive (self only). */
async function repairExecutiveBookingAssignments(admin) {
  const email = normalizeEmail(admin?.email);
  if (!email) return;

  const staffIds = await resolveSelfStaffIds(admin);
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
  CRE_ASSIGNABLE_DESIGNATIONS,
  isUnrestrictedViewer,
  resolveReportsScope,
  isOrganisationScopedUser,
  isCreUser,
  isCreAssignableDesignation,
  isExecutiveScopedUser,
  isTeamScopedUser,
  collectSubtreeStaffIds,
  resolveStaffIdsForUser,
  resolveSelfStaffIds,
  resolveStaffEmailsForIds,
  assignedToStaffFilter,
  assignedToStaffFilterAsync,
  assignedToIdsFilter,
  leadAssignedToStaff,
  leadReadableByAdmin,
  applyLeadAssignment,
  repairExecutiveLeadAssignments,
  assignedExecutiveIdsFilter,
  assignedExecutiveFilterAsync,
  bookingAssignedToStaff,
  applyBookingExecutiveAssignment,
  repairExecutiveBookingAssignments,
};
