/**
 * Canonical CRE / CRM desk access — same Lead CRM rights as CRE 1 / CRE 2.
 * Portal: staff login → My Dashboard + full Lead CRM (view/create/update/delete/assign/export).
 *
 * CRE users are stamped to exactly these modules.
 * CRM desk users (e.g. Priya Jaiswal) receive the same Lead CRM rights on top of
 * any extra modules they already have (complaints, booking reports, …).
 */

const CRE_MODULES = ['my_dashboard', 'crm_leads', 'td_lead_reports'];
const CRE_ACTIONS = [
  'my_dashboard:view',
  'crm_leads:view',
  'crm_leads:create',
  'crm_leads:update',
  'crm_leads:delete',
  'crm_leads:assign',
  'crm_leads:export',
  'td_lead_reports:view',
  'td_lead_reports:export',
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

/** True for Priya Ma'am's CRM desk and any CRM staff row. */
function isCrmDeskDesignation(raw) {
  const d = normalizeDesignation(raw);
  if (!d) return false;
  if (isCreDesignation(raw)) return false;
  if (d === 'crm' || /^crm\s*\d+$/.test(d)) return true;
  if (d === 'crm user' || d === 'crm executive' || d === 'crm manager') return true;
  return false;
}

function isCreUser(admin) {
  return isCreDesignation(admin?.designation);
}

function isCrmDeskUser(admin) {
  return isCrmDeskDesignation(admin?.designation);
}

/** CRE or CRM desk — organisation-wide Lead CRM (same visibility as CRE 1 / CRE 2). */
function isCreOrCrmDeskUser(admin) {
  return isCreUser(admin) || isCrmDeskUser(admin);
}

function sameStringList(a, b) {
  const left = [...(Array.isArray(a) ? a : [])].map(String).sort();
  const right = [...(Array.isArray(b) ? b : [])].map(String).sort();
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
}

function unionStringList(current, extra) {
  const set = new Set();
  for (const v of [...(Array.isArray(current) ? current : []), ...(Array.isArray(extra) ? extra : [])]) {
    const s = String(v || '').trim();
    if (s) set.add(s);
  }
  return [...set];
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

/** Staff linked to a Roles template — permissions come from StaffRole, not CRE/CRM defaults. */
function hasStaffRoleTemplate(staff) {
  if (!staff) return false;
  const id = staff.staffRoleId;
  if (!id) return false;
  if (typeof id === 'object' && id._id) return true;
  return Boolean(id);
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

/** Mongo filter matching CRM desk staff (not CRE). */
function crmDeskMongoFilter() {
  return {
    $or: [
      { designation: { $regex: /^crm$/i } },
      { designation: { $regex: /^crm[\s_-]*\d+$/i } },
      { designation: { $regex: /^crm[\s_-]*(user|executive|manager)$/i } },
    ],
  };
}

/**
 * Stamp CRE 1 / CRE 2 rights onto a CRE staff document (mongoose or plain).
 * @returns {boolean} whether anything changed
 */
function applyCreAccessInPlace(staff) {
  if (!staff || !isCreDesignation(staff.designation)) return false;
  if (hasStaffRoleTemplate(staff)) return false;
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

/**
 * Give a CRM desk user the same Lead CRM rights as CRE 1 / CRE 2, without
 * removing extra modules (complaints, booking reports, etc.).
 */
function applyCrmDeskAccessInPlace(staff) {
  if (!staff || !isCrmDeskDesignation(staff.designation)) return false;
  if (hasStaffRoleTemplate(staff)) return false;
  let changed = false;
  if (staff.designation !== 'crm') {
    staff.designation = 'crm';
    changed = true;
  }
  if (staff.reportsScope !== 'organisation') {
    staff.reportsScope = 'organisation';
    changed = true;
  }
  const modules = unionStringList(staff.allowedModules, CRE_MODULES);
  if (!sameStringList(staff.allowedModules, modules)) {
    staff.allowedModules = modules;
    changed = true;
  }
  const actions = unionStringList(staff.allowedActions, CRE_ACTIONS);
  if (!sameStringList(staff.allowedActions, actions)) {
    staff.allowedActions = actions;
    changed = true;
  }
  return changed;
}

function withCreAccess(payload) {
  if (!isCreUser(payload)) return payload;
  if (hasStaffRoleTemplate(payload)) return payload;
  const desired = creAccessFields();
  return {
    ...payload,
    designation: desired.designation,
    role: desired.role,
    allowedModules: desired.allowedModules,
    allowedActions: desired.allowedActions,
  };
}

function withCrmDeskAccess(payload) {
  if (!isCrmDeskUser(payload)) return payload;
  if (hasStaffRoleTemplate(payload)) return payload;
  return {
    ...payload,
    designation: 'crm',
    reportsScope: 'organisation',
    allowedModules: unionStringList(payload.allowedModules, CRE_MODULES),
    allowedActions: unionStringList(payload.allowedActions, CRE_ACTIONS),
  };
}

/** Session payload: CRE stamp, or CRM desk union. */
function withDeskAccess(payload) {
  if (isCreUser(payload)) return withCreAccess(payload);
  if (isCrmDeskUser(payload)) return withCrmDeskAccess(payload);
  return payload;
}

async function syncAllCreStaffAccess(TDStaff) {
  const result = await TDStaff.updateMany(
    {
      ...creStaffMongoFilter(),
      $or: [{ staffRoleId: null }, { staffRoleId: { $exists: false } }],
    },
    { $set: creAccessFields() },
  );
  return {
    matched: result.matchedCount ?? result.n ?? 0,
    modified: result.modifiedCount ?? result.nModified ?? 0,
  };
}

async function syncAllCrmDeskAccess(TDStaff) {
  const rows = await TDStaff.find({
    ...crmDeskMongoFilter(),
    $or: [{ staffRoleId: null }, { staffRoleId: { $exists: false } }],
  });
  let modified = 0;
  for (const row of rows) {
    if (applyCrmDeskAccessInPlace(row)) {
      await row.save();
      modified += 1;
    }
  }
  return { matched: rows.length, modified };
}

module.exports = {
  CRE_MODULES,
  CRE_ACTIONS,
  isCreDesignation,
  isCrmDeskDesignation,
  isCreUser,
  isCrmDeskUser,
  isCreOrCrmDeskUser,
  creAccessFields,
  hasStaffRoleTemplate,
  creStaffMongoFilter,
  crmDeskMongoFilter,
  applyCreAccessInPlace,
  applyCrmDeskAccessInPlace,
  withCreAccess,
  withCrmDeskAccess,
  withDeskAccess,
  syncAllCreStaffAccess,
  syncAllCrmDeskAccess,
};
