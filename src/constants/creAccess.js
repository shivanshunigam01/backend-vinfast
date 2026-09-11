/**
 * Canonical CRE (Customer Relationship Executive) access — same as CRE 1 / CRE 2.
 * Portal: staff login → My Dashboard + full Lead CRM (view/create/update/delete/assign/export).
 */

const CRE_MODULES = ['my_dashboard', 'crm_leads'];
const CRE_ACTIONS = [
  'my_dashboard:view',
  'crm_leads:view',
  'crm_leads:create',
  'crm_leads:update',
  'crm_leads:delete',
  'crm_leads:assign',
  'crm_leads:export',
];

function normalizeDesignation(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** True for CRE 1 / CRE 2 / any CRE staff (including "CRE 3", "Customer Relationship Executive"). */
function isCreDesignation(raw) {
  const d = normalizeDesignation(raw);
  if (!d) return false;
  if (d === 'cre' || /^cre\s*\d+$/.test(d)) return true;
  if (d === 'customer relationship executive' || d === 'customer relationship') return true;
  return false;
}

function isCreUser(admin) {
  return isCreDesignation(admin?.designation);
}

function sameStringList(a, b) {
  const left = [...(Array.isArray(a) ? a : [])].map(String).sort();
  const right = [...(Array.isArray(b) ? b : [])].map(String).sort();
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
}

function creAccessFields() {
  return {
    designation: 'cre',
    role: 'executive',
    reportsScope: 'organisation',
    allowedModules: [...CRE_MODULES],
    allowedActions: [...CRE_ACTIONS],
  };
}

/** Mongo filter matching every CRE staff row. */
function creStaffMongoFilter() {
  return {
    $or: [
      { designation: { $regex: /^cre$/i } },
      { designation: { $regex: /^cre[\s_-]*\d+$/i } },
      { designation: { $regex: /customer relationship/i } },
    ],
  };
}

/**
 * Stamp CRE 1 / CRE 2 rights onto a staff document (mongoose or plain).
 * @returns {boolean} whether anything changed
 */
function applyCreAccessInPlace(staff) {
  if (!staff || !isCreDesignation(staff.designation)) return false;
  const desired = creAccessFields();
  let changed = false;
  if (staff.designation !== desired.designation) {
    staff.designation = desired.designation;
    changed = true;
  }
  if (staff.role !== desired.role) {
    staff.role = desired.role;
    changed = true;
  }
  if (staff.reportsScope !== desired.reportsScope) {
    staff.reportsScope = desired.reportsScope;
    changed = true;
  }
  if (!sameStringList(staff.allowedModules, desired.allowedModules)) {
    staff.allowedModules = desired.allowedModules;
    changed = true;
  }
  if (!sameStringList(staff.allowedActions, desired.allowedActions)) {
    staff.allowedActions = desired.allowedActions;
    changed = true;
  }
  return changed;
}

function withCreAccess(payload) {
  if (!isCreUser(payload)) return payload;
  const desired = creAccessFields();
  return {
    ...payload,
    designation: desired.designation,
    role: desired.role,
    allowedModules: desired.allowedModules,
    allowedActions: desired.allowedActions,
  };
}

async function syncAllCreStaffAccess(TDStaff) {
  const result = await TDStaff.updateMany(creStaffMongoFilter(), { $set: creAccessFields() });
  return {
    matched: result.matchedCount ?? result.n ?? 0,
    modified: result.modifiedCount ?? result.nModified ?? 0,
  };
}

module.exports = {
  CRE_MODULES,
  CRE_ACTIONS,
  isCreDesignation,
  isCreUser,
  creAccessFields,
  creStaffMongoFilter,
  applyCreAccessInPlace,
  withCreAccess,
  syncAllCreStaffAccess,
};
