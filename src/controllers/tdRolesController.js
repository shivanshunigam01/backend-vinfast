const StaffRole = require('../models/StaffRole');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { sanitizeModules, sanitizeActions } = require('../utils/modulePermissions');
const { ADMIN_MODULE_ACTIONS } = require('../constants/adminModules');

const AUTH_ROLES = ['executive', 'manager'];

const EXECUTIVE_DEFAULT_MODULES = ['my_dashboard', 'td_my_bookings', 'crm_leads', 'calendar'];
const MANAGER_DEFAULT_MODULES = [
  'dashboard',
  'calendar',
  'crm_leads',
  'crm_lead_stages',
  'my_dashboard',
  'td_my_bookings',
  'td_bookings',
  'td_reschedule_history',
  'td_fleet_health',
  'td_lead_reports',
  'td_reports',
  'delivery_reports',
];

function allActionTokensForModules(modules) {
  const tokens = [];
  for (const key of modules) {
    const actions = ADMIN_MODULE_ACTIONS[key] || ['view'];
    for (const a of actions) tokens.push(`${key}:${a}`);
  }
  return tokens;
}

function formatRole(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: plain._id,
    name: plain.name,
    description: plain.description || '',
    authRole: plain.authRole || 'executive',
    allowedModules: Array.isArray(plain.allowedModules) ? plain.allowedModules : [],
    allowedActions: Array.isArray(plain.allowedActions) ? plain.allowedActions : [],
    active: Boolean(plain.active),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

/** Ensure Sales Executive / Sales Manager templates exist. */
async function ensureDefaultRoles() {
  const defaults = [
    {
      name: 'Sales Executive',
      description: 'Field executive — own bookings, CRM leads, calendar',
      authRole: 'executive',
      allowedModules: EXECUTIVE_DEFAULT_MODULES,
      allowedActions: allActionTokensForModules(EXECUTIVE_DEFAULT_MODULES),
    },
    {
      name: 'Sales Manager',
      description: 'Manager — bookings, reports, CRM, fleet overview',
      authRole: 'manager',
      allowedModules: MANAGER_DEFAULT_MODULES,
      allowedActions: allActionTokensForModules(MANAGER_DEFAULT_MODULES),
    },
  ];

  for (const row of defaults) {
    const exists = await StaffRole.findOne({ name: row.name });
    if (!exists) await StaffRole.create(row);
  }
}

exports.ensureDefaultRoles = ensureDefaultRoles;

exports.listRoles = asyncHandler(async (req, res) => {
  await ensureDefaultRoles();
  const query = {};
  if (req.query.active === 'true') query.active = true;
  if (req.query.active === 'false') query.active = false;
  const docs = await StaffRole.find(query).sort({ name: 1 });
  return successResponse(res, docs.map(formatRole));
});

exports.getRole = asyncHandler(async (req, res) => {
  const doc = await StaffRole.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Role not found');
  return successResponse(res, formatRole(doc));
});

exports.createRole = asyncHandler(async (req, res) => {
  const { name, description, authRole, allowedModules, allowedActions, active } = req.body || {};
  if (!name || !String(name).trim()) throw new ApiError(400, 'Role name is required');

  const modules = sanitizeModules(allowedModules) || [];
  const actions = sanitizeActions(allowedActions, modules) || [];
  const role = AUTH_ROLES.includes(authRole) ? authRole : 'executive';

  const exists = await StaffRole.findOne({ name: String(name).trim() });
  if (exists) throw new ApiError(409, 'A role with this name already exists');

  const doc = await StaffRole.create({
    name: String(name).trim(),
    description: description != null ? String(description).trim() : '',
    authRole: role,
    allowedModules: modules,
    allowedActions: actions,
    active: active !== false,
  });

  return successResponse(res, formatRole(doc), 'Role created', 201);
});

exports.updateRole = asyncHandler(async (req, res) => {
  const doc = await StaffRole.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Role not found');

  const { name, description, authRole, allowedModules, allowedActions, active } = req.body || {};
  if (name !== undefined) {
    const next = String(name).trim();
    if (!next) throw new ApiError(400, 'Role name is required');
    const clash = await StaffRole.findOne({ name: next, _id: { $ne: doc._id } });
    if (clash) throw new ApiError(409, 'A role with this name already exists');
    doc.name = next;
  }
  if (description !== undefined) doc.description = String(description).trim();
  if (authRole !== undefined) {
    if (!AUTH_ROLES.includes(authRole)) {
      throw new ApiError(400, `authRole must be one of: ${AUTH_ROLES.join(', ')}`);
    }
    doc.authRole = authRole;
  }
  const modules = sanitizeModules(allowedModules);
  if (modules !== undefined) doc.allowedModules = modules;
  const actions = sanitizeActions(
    allowedActions,
    modules !== undefined ? modules : doc.allowedModules,
  );
  if (actions !== undefined) doc.allowedActions = actions;
  if (active !== undefined) doc.active = Boolean(active);

  await doc.save();
  return successResponse(res, formatRole(doc), 'Role updated');
});

exports.deleteRole = asyncHandler(async (req, res) => {
  const doc = await StaffRole.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Role not found');

  const TDStaff = require('../models/TDStaff');
  const inUse = await TDStaff.countDocuments({ staffRoleId: doc._id });
  if (inUse > 0) {
    throw new ApiError(
      400,
      `Cannot delete — ${inUse} user(s) still assigned to this role. Reassign them first.`,
    );
  }

  await doc.deleteOne();
  return successResponse(res, { _id: doc._id }, 'Role deleted');
});
