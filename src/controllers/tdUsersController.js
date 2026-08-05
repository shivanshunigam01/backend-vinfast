require('../models/tdModels');

const crypto = require('crypto');
const TDStaff = require('../models/TDStaff');
const { STAFF_DESIGNATIONS } = require('../models/TDStaff');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { DESIGNATION_LABELS } = require('../utils/tdBookingFormatter');
const { ensureTdStaff } = require('../utils/tdBootstrap');
const { sanitizeModules, sanitizeActions } = require('../utils/modulePermissions');
const { isTeamScopedUser, resolveStaffIdsForUser, isCreUser, isCreAssignableDesignation } = require('../utils/leadAssignment');

const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';

function generateSecurePassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

const STAFF_ROLES = ['executive', 'manager'];
const StaffRole = require('../models/StaffRole');

function formatStaff(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  let reportsTo = plain.reportsTo || null;
  if (reportsTo && typeof reportsTo === 'object') {
    reportsTo = {
      _id: reportsTo._id,
      name: reportsTo.name,
      email: reportsTo.email,
      designation: reportsTo.designation,
    };
  }
  let staffRole = null;
  if (plain.staffRoleId && typeof plain.staffRoleId === 'object') {
    staffRole = {
      _id: plain.staffRoleId._id,
      name: plain.staffRoleId.name,
      authRole: plain.staffRoleId.authRole,
    };
  }
  return {
    _id: plain._id,
    name: plain.name,
    email: plain.email,
    mobile: plain.mobile || null,
    role: plain.role,
    designation: plain.designation,
    designationLabel: DESIGNATION_LABELS[plain.designation] || plain.designation,
    isCustomDesignation: !STAFF_DESIGNATIONS.includes(plain.designation),
    reportsTo,
    staffRoleId: plain.staffRoleId?._id || plain.staffRoleId || null,
    staffRole,
    active: Boolean(plain.active),
    allowedModules: Array.isArray(plain.allowedModules) ? plain.allowedModules : [],
    allowedActions: Array.isArray(plain.allowedActions) ? plain.allowedActions : [],
    createdAt: plain.createdAt,
  };
}

function normalizeStaffMobile(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return d;
}

/**
 * When staffRoleId is provided, load the role and return ACL + authRole to apply.
 * If staffRoleId is null/empty string, clears the role link (caller sets staffRoleId null).
 */
async function resolveStaffRoleAssignment(staffRoleId) {
  if (staffRoleId === undefined) return undefined;
  if (!staffRoleId) {
    return { staffRoleId: null, applyAcl: false };
  }
  const role = await StaffRole.findById(staffRoleId);
  if (!role) throw new ApiError(400, 'Staff role not found');
  if (!role.active) throw new ApiError(400, 'This role is inactive');
  return {
    staffRoleId: role._id,
    applyAcl: true,
    authRole: role.authRole || 'executive',
    allowedModules: Array.isArray(role.allowedModules) ? role.allowedModules : [],
    allowedActions: Array.isArray(role.allowedActions) ? role.allowedActions : [],
  };
}

/**
 * Accepts a known designation key, or a custom position typed by the admin
 * (e.g. "Telecaller"). Returns the value to store, or throws on bad input.
 */
function resolveDesignation(designation) {
  const value = String(designation || '').trim();
  if (!value) throw new ApiError(400, 'Designation is required');
  if (STAFF_DESIGNATIONS.includes(value)) return value;
  if (value.length > 60) throw new ApiError(400, 'Custom position must be 60 characters or less');
  return value.replace(/\s+/g, ' ');
}

/** Role derived from designation; custom positions default to executive unless a role is sent. */
function resolveRole(designation, requestedRole) {
  if (requestedRole !== undefined) {
    if (!STAFF_ROLES.includes(requestedRole)) {
      throw new ApiError(400, `Role must be one of: ${STAFF_ROLES.join(', ')}`);
    }
    return requestedRole;
  }
  if (STAFF_DESIGNATIONS.includes(designation)) {
    return designation === 'sales_executive' || designation === 'cre' ? 'executive' : 'manager';
  }
  return 'executive';
}

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};
  if (req.query.designation && req.query.designation !== 'all') {
    query.designation = String(req.query.designation).trim();
  }

  let [docs, total] = await Promise.all([
    TDStaff.find(query)
      .populate('reportsTo', 'name email designation')
      .populate('staffRoleId', 'name authRole')
      .sort({ designation: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    TDStaff.countDocuments(query),
  ]);

  if (
    total === 0 &&
    page === 1 &&
    (!req.query.designation || req.query.designation === 'all')
  ) {
    await ensureTdStaff();
    [docs, total] = await Promise.all([
      TDStaff.find(query)
        .populate('reportsTo', 'name email designation')
        .populate('staffRoleId', 'name authRole')
        .sort({ designation: 1, name: 1 })
        .skip(skip)
        .limit(limit),
      TDStaff.countDocuments(query),
    ]);
  }

  return successResponse(res, docs.map(formatStaff), undefined, 200, { page, limit, total });
});

exports.createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    mobile,
    password,
    designation,
    role,
    active,
    allowedModules,
    allowedActions,
    reportsTo,
    staffRoleId,
  } = req.body || {};
  if (!name || !email) throw new ApiError(400, 'Name and email are required');
  if (!password || String(password).length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }
  const mobile10 = normalizeStaffMobile(mobile);
  if (!mobile10) {
    throw new ApiError(400, 'Valid 10-digit WhatsApp mobile number is required');
  }

  const resolvedDesignation = resolveDesignation(designation || 'sales_executive');
  let resolvedRole = resolveRole(resolvedDesignation, role);
  let linkedRoleId = null;
  let modules;
  let actions;

  const roleAssign = await resolveStaffRoleAssignment(staffRoleId);
  if (roleAssign?.applyAcl) {
    linkedRoleId = roleAssign.staffRoleId;
    resolvedRole = roleAssign.authRole;
    modules = Array.isArray(allowedModules)
      ? sanitizeModules(allowedModules) || []
      : roleAssign.allowedModules;
    actions = Array.isArray(allowedActions)
      ? sanitizeActions(allowedActions, modules) || []
      : sanitizeActions(roleAssign.allowedActions, modules) || [];
  } else {
    if (roleAssign && staffRoleId !== undefined) linkedRoleId = null;
    modules = sanitizeModules(allowedModules) || [];
    actions = sanitizeActions(allowedActions, modules) || [];
  }

  const exists = await TDStaff.findOne({ email: String(email).trim().toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already registered');

  const mobileTaken = await TDStaff.findOne({ mobile: mobile10 });
  if (mobileTaken) throw new ApiError(409, 'This WhatsApp mobile is already registered to another user');

  let reportsToId = null;
  if (reportsTo) {
    const manager = await TDStaff.findById(reportsTo);
    if (!manager) throw new ApiError(400, 'reportsTo manager not found');
    reportsToId = manager._id;
  }

  const doc = await TDStaff.create({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    mobile: mobile10,
    password: String(password),
    designation: resolvedDesignation,
    role: resolvedRole,
    active: active !== false,
    allowedModules: modules,
    allowedActions: actions,
    reportsTo: reportsToId,
    staffRoleId: linkedRoleId,
  });

  await doc.populate('staffRoleId', 'name authRole');
  return successResponse(res, formatStaff(doc), 'User created', 201);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const wantsPassword =
    req.body?.password !== undefined &&
    req.body?.password !== null &&
    String(req.body.password).length > 0;

  // Must load +password when rotating credentials — select:false fields otherwise
  // skip the hash hook / leave login out of sync with passwordPlain.
  const doc = await TDStaff.findById(req.params.id).select(wantsPassword ? '+password +passwordPlain' : undefined);
  if (!doc) throw new ApiError(404, 'User not found');

  const {
    name,
    email,
    mobile,
    password,
    designation,
    role,
    active,
    allowedModules,
    allowedActions,
    reportsTo,
    staffRoleId,
  } = req.body || {};
  if (name !== undefined) doc.name = String(name).trim();
  if (email !== undefined) doc.email = String(email).trim().toLowerCase();
  if (mobile !== undefined) {
    const mobile10 = normalizeStaffMobile(mobile);
    if (!mobile10) {
      throw new ApiError(400, 'Valid 10-digit WhatsApp mobile number is required');
    }
    const mobileTaken = await TDStaff.findOne({ mobile: mobile10, _id: { $ne: doc._id } });
    if (mobileTaken) throw new ApiError(409, 'This WhatsApp mobile is already registered to another user');
    doc.mobile = mobile10;
  }
  if (wantsPassword) {
    const nextPassword = String(password).trim();
    if (nextPassword.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }
    doc.password = nextPassword;
    doc.markModified('password');
  }
  if (designation !== undefined) {
    doc.designation = resolveDesignation(designation);
    doc.role = resolveRole(doc.designation, role);
  } else if (role !== undefined) {
    doc.role = resolveRole(doc.designation, role);
  }
  if (active !== undefined) doc.active = Boolean(active);

  // Role template assignment: copy permissions when staffRoleId changes (or is set).
  if (staffRoleId !== undefined) {
    const roleAssign = await resolveStaffRoleAssignment(staffRoleId);
    if (roleAssign?.applyAcl) {
      doc.staffRoleId = roleAssign.staffRoleId;
      doc.role = roleAssign.authRole;
      // If client also sent ACL, use that; otherwise apply role template.
      if (Array.isArray(allowedModules) || Array.isArray(allowedActions)) {
        const modules = Array.isArray(allowedModules)
          ? sanitizeModules(allowedModules) || []
          : doc.allowedModules;
        doc.allowedModules = modules;
        doc.allowedActions = Array.isArray(allowedActions)
          ? sanitizeActions(allowedActions, modules) || []
          : sanitizeActions(roleAssign.allowedActions, modules) || [];
      } else {
        doc.allowedModules = roleAssign.allowedModules;
        doc.allowedActions = roleAssign.allowedActions;
      }
    } else {
      doc.staffRoleId = null;
      const modules = sanitizeModules(allowedModules);
      if (modules !== undefined) doc.allowedModules = modules;
      const actions = sanitizeActions(
        allowedActions,
        modules !== undefined ? modules : doc.allowedModules,
      );
      if (actions !== undefined) doc.allowedActions = actions;
    }
  } else {
    const modules = sanitizeModules(allowedModules);
    if (modules !== undefined) doc.allowedModules = modules;
    const actions = sanitizeActions(
      allowedActions,
      modules !== undefined ? modules : doc.allowedModules,
    );
    if (actions !== undefined) doc.allowedActions = actions;
  }

  if (reportsTo !== undefined) {
    if (!reportsTo) {
      doc.reportsTo = null;
    } else {
      if (String(reportsTo) === String(doc._id)) {
        throw new ApiError(400, 'A user cannot report to themselves');
      }
      const manager = await TDStaff.findById(reportsTo);
      if (!manager) throw new ApiError(400, 'reportsTo manager not found');
      doc.reportsTo = manager._id;
    }
  }

  await doc.save();
  await doc.populate('staffRoleId', 'name authRole');
  return successResponse(res, formatStaff(doc), 'User updated');
});

/**
 * Reveal a staff member's saved password (User Master "eye" feature).
 * Restricted to managers/superadmins. Users created before this feature
 * have no stored copy until a new password is set via Edit.
 */
exports.getUserPassword = asyncHandler(async (req, res) => {
  const doc = await TDStaff.findById(req.params.id).select('+passwordPlain name email');
  if (!doc) throw new ApiError(404, 'User not found');

  return successResponse(res, {
    _id: doc._id,
    email: doc.email,
    password: doc.passwordPlain || null,
    available: Boolean(doc.passwordPlain),
  });
});

/**
 * Reset a staff member's password. Optional body.newPassword (min 8),
 * otherwise a secure password is generated. Returns the plain password once.
 * bcrypt hash + passwordPlain are set via the TDStaff pre-save hook.
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const doc = await TDStaff.findById(req.params.id).select('+password +passwordPlain');
  if (!doc) throw new ApiError(404, 'User not found');

  const requested =
    req.body?.newPassword !== undefined && req.body?.newPassword !== null
      ? String(req.body.newPassword).trim()
      : '';
  const plainText = requested || generateSecurePassword(12);
  if (plainText.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  doc.password = plainText;
  doc.markModified('password');
  await doc.save();

  return successResponse(res, { password: plainText }, 'Password reset');
});

exports.patchUser = asyncHandler(async (req, res) => {
  const doc = await TDStaff.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'User not found');
  if (req.body?.active !== undefined) doc.active = Boolean(req.body.active);
  await doc.save();
  return successResponse(res, formatStaff(doc), 'User updated');
});

/**
 * Permanently delete a staff user (for cleaning up unwanted/junk accounts).
 * Any leads or test drive bookings assigned to them are automatically
 * unassigned so managers can reassign that work from the CRM.
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const doc = await TDStaff.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'User not found');

  if (String(doc._id) === String(req.admin._id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  const Lead = require('../models/Lead');
  const TDBooking = require('../models/TDBooking');
  const email = doc.email ? String(doc.email).trim().toLowerCase() : null;

  const leadFilter = {
    $or: [{ assignedTo: doc._id }, ...(email ? [{ assignedToEmail: email }] : [])],
  };
  const bookingFilter = {
    $or: [{ assignedExecutive: doc._id }, ...(email ? [{ assignedExecutiveEmail: email }] : [])],
  };

  const [leadResult, bookingResult] = await Promise.all([
    Lead.updateMany(leadFilter, { $unset: { assignedTo: 1, assignedToEmail: 1 } }),
    TDBooking.updateMany(bookingFilter, {
      $unset: { assignedExecutive: 1, assignedExecutiveEmail: 1 },
    }),
  ]);

  await doc.deleteOne();

  const unassignedLeads = leadResult.modifiedCount || 0;
  const unassignedBookings = bookingResult.modifiedCount || 0;
  const detail =
    unassignedLeads > 0 || unassignedBookings > 0
      ? ` — ${unassignedLeads} lead(s) and ${unassignedBookings} test drive booking(s) moved to Unassigned`
      : '';

  return successResponse(
    res,
    { _id: doc._id, unassignedLeads, unassignedBookings },
    `User ${doc.name} deleted${detail}`,
  );
});

async function listAssignableStaff(viewer) {
  // Include custom positions added via User Master, not just the fixed hierarchy.
  const docs = await TDStaff.find({ active: true })
    .select('name email role designation reportsTo active')
    .sort({ designation: 1, name: 1 })
    .lean();

  let filtered = docs;

  // CRE assigns to Sales Executives and Sales Managers.
  if (viewer && isCreUser(viewer)) {
    filtered = docs.filter((row) => isCreAssignableDesignation(row.designation));
  } else if (viewer && isTeamScopedUser(viewer)) {
    const allowed = new Set(await resolveStaffIdsForUser(viewer));
    filtered = docs.filter((row) => allowed.has(String(row._id)));
  }

  return filtered.map((row) => ({
    ...row,
    designationLabel: DESIGNATION_LABELS[row.designation] || row.designation,
  }));
}

exports.listAssignable = asyncHandler(async (req, res) => {
  const data = await listAssignableStaff(req.admin);
  return successResponse(res, data);
});

exports.listAssignableStaff = listAssignableStaff;
