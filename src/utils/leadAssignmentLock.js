const Lead = require('../models/Lead');
const ApiError = require('../utils/apiError');
const { isWebsiteDirectLead } = require('./leadModuleFilters');
const { isCrmLeadUnassigned } = require('./leadUnassigned');

/** How long a CRM/CRE seat holds an unassigned website lead open for assignment. */
const LOCK_TTL_MS = 10 * 60 * 1000;

function canBypassWebsiteAssignmentLock(admin) {
  if (!admin) return false;
  if (admin.userType === 'admin') return true;
  const role = String(admin.role || '').toLowerCase();
  return role === 'superadmin' || role === 'manager';
}

function staffIdString(admin) {
  if (!admin?._id) return '';
  return String(admin._id);
}

function lockExpired(lock, now = new Date()) {
  if (!lock?.expiresAt) return true;
  return new Date(lock.expiresAt).getTime() <= now.getTime();
}

function normalizeLock(plain) {
  const lock = plain?.assignmentLock;
  if (!lock?.staffId || lockExpired(lock)) return null;
  return {
    staffId: String(lock.staffId),
    staffName: String(lock.staffName || 'CRM user').trim() || 'CRM user',
    staffEmail: lock.staffEmail ? String(lock.staffEmail) : '',
    lockedAt: lock.lockedAt || null,
    expiresAt: lock.expiresAt || null,
  };
}

/** True when multiple CRM/CRE users could race on the same website intake row. */
function websiteLeadNeedsAssignmentLock(plain) {
  return isWebsiteDirectLead(plain) && isCrmLeadUnassigned(plain);
}

function resolveWebsiteAssignmentAccess(plain, admin) {
  const needsLock = websiteLeadNeedsAssignmentLock(plain);
  const lock = normalizeLock(plain);
  const viewerId = staffIdString(admin);
  const heldBySelf = Boolean(lock && viewerId && lock.staffId === viewerId);
  const bypass = canBypassWebsiteAssignmentLock(admin);
  const blockedByOther = Boolean(needsLock && lock && !heldBySelf && !bypass);
  const editable = !blockedByOther;

  let assignmentLockMessage = null;
  if (blockedByOther) {
    assignmentLockMessage = `${lock.staffName} is already working on assignment for this lead`;
  }

  return {
    websiteDirectUnassigned: needsLock,
    assignmentLock: lock,
    websiteAssignmentEditable: editable,
    assignmentLockHeldBySelf: heldBySelf,
    assignmentLockMessage,
  };
}

function lockFilterForAcquire(staffId, now = new Date()) {
  return {
    $or: [
      { assignmentLock: { $exists: false } },
      { assignmentLock: null },
      { 'assignmentLock.staffId': { $exists: false } },
      { 'assignmentLock.staffId': null },
      { 'assignmentLock.expiresAt': { $lte: now } },
      { 'assignmentLock.staffId': staffId },
    ],
  };
}

async function acquireWebsiteLeadAssignmentLock(leadId, admin) {
  if (!admin?._id) throw new ApiError(401, 'Not authenticated');

  const existing = await Lead.findById(leadId).lean();
  if (!existing) throw new ApiError(404, 'Lead not found');
  if (!websiteLeadNeedsAssignmentLock(existing)) {
    return { lead: existing, acquired: false, skipped: true };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);
  const staffId = admin._id;
  const staffName = String(admin.name || admin.email || 'CRM user').trim() || 'CRM user';

  const currentLock = normalizeLock(existing);
  if (
    currentLock &&
    currentLock.staffId !== String(staffId) &&
    !canBypassWebsiteAssignmentLock(admin)
  ) {
    throw new ApiError(
      409,
      `${currentLock.staffName} is already working on assignment for this lead`,
      {
        assignmentLock: currentLock,
        websiteAssignmentEditable: false,
      },
    );
  }

  const updated = await Lead.findOneAndUpdate(
    {
      _id: leadId,
      ...lockFilterForAcquire(staffId, now),
    },
    {
      $set: {
        assignmentLock: {
          staffId,
          staffName,
          staffEmail: admin.email || '',
          lockedAt: now,
          expiresAt,
        },
      },
    },
    { new: true },
  ).lean();

  if (!updated) {
    const again = await Lead.findById(leadId).lean();
    const lock = normalizeLock(again);
    throw new ApiError(
      409,
      lock
        ? `${lock.staffName} is already working on assignment for this lead`
        : 'Could not acquire assignment lock — try again',
      { assignmentLock: lock, websiteAssignmentEditable: false },
    );
  }

  return { lead: updated, acquired: true, skipped: false };
}

async function releaseWebsiteLeadAssignmentLock(leadId, admin) {
  if (!admin?._id) throw new ApiError(401, 'Not authenticated');
  const lead = await Lead.findById(leadId);
  if (!lead) throw new ApiError(404, 'Lead not found');

  const lock = normalizeLock(lead);
  if (!lock) return { released: false };

  const viewerId = staffIdString(admin);
  if (lock.staffId !== viewerId && !canBypassWebsiteAssignmentLock(admin)) {
    throw new ApiError(403, 'Only the user working on this lead can release the lock');
  }

  lead.assignmentLock = undefined;
  await lead.save({ validateBeforeSave: false });
  return { released: true };
}

function assertWebsiteLeadAssignmentEditable(lead, admin) {
  if (!websiteLeadNeedsAssignmentLock(lead)) return;
  const access = resolveWebsiteAssignmentAccess(lead, admin);
  if (!access.websiteAssignmentEditable) {
    throw new ApiError(423, access.assignmentLockMessage || 'This lead is locked for assignment', {
      assignmentLock: access.assignmentLock,
      websiteAssignmentEditable: false,
    });
  }
}

async function clearWebsiteLeadAssignmentLock(leadDoc) {
  if (!leadDoc?.assignmentLock) return;
  leadDoc.assignmentLock = undefined;
}

module.exports = {
  LOCK_TTL_MS,
  canBypassWebsiteAssignmentLock,
  websiteLeadNeedsAssignmentLock,
  resolveWebsiteAssignmentAccess,
  acquireWebsiteLeadAssignmentLock,
  releaseWebsiteLeadAssignmentLock,
  assertWebsiteLeadAssignmentEditable,
  clearWebsiteLeadAssignmentLock,
};
