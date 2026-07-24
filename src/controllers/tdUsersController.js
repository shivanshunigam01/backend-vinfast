require('../models/tdModels');

const TDStaff = require('../models/TDStaff');
const { STAFF_DESIGNATIONS } = require('../models/TDStaff');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { DESIGNATION_LABELS } = require('../utils/tdBookingFormatter');
const { ensureTdStaff } = require('../utils/tdBootstrap');
const { ADMIN_MODULE_KEYS } = require('../constants/adminModules');

const STAFF_ROLES = ['executive', 'manager'];

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
  return {
    _id: plain._id,
    name: plain.name,
    email: plain.email,
    role: plain.role,
    designation: plain.designation,
    designationLabel: DESIGNATION_LABELS[plain.designation] || plain.designation,
    isCustomDesignation: !STAFF_DESIGNATIONS.includes(plain.designation),
    reportsTo,
    active: Boolean(plain.active),
    allowedModules: Array.isArray(plain.allowedModules) ? plain.allowedModules : [],
    allowedActions: Array.isArray(plain.allowedActions) ? plain.allowedActions : [],
    createdAt: plain.createdAt,
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
    return designation === 'sales_executive' ? 'executive' : 'manager';
  }
  return 'executive';
}

/** Keeps only recognised module keys (deduped). Returns undefined when not provided. */
function sanitizeModules(allowedModules) {
  if (allowedModules === undefined) return undefined;
  if (!Array.isArray(allowedModules)) {
    throw new ApiError(400, 'allowedModules must be an array of module keys');
  }
  return [...new Set(allowedModules.map((m) => String(m).trim()))].filter((m) =>
    ADMIN_MODULE_KEYS.includes(m),
  );
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
        .sort({ designation: 1, name: 1 })
        .skip(skip)
        .limit(limit),
      TDStaff.countDocuments(query),
    ]);
  }

  return successResponse(res, docs.map(formatStaff), undefined, 200, { page, limit, total });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, designation, role, active, allowedModules, allowedActions, reportsTo } =
    req.body || {};
  if (!name || !email) throw new ApiError(400, 'Name and email are required');
  if (!password || String(password).length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  const resolvedDesignation = resolveDesignation(designation || 'sales_executive');
  const modules = sanitizeModules(allowedModules);

  const exists = await TDStaff.findOne({ email: String(email).trim().toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already registered');

  let reportsToId = null;
  if (reportsTo) {
    const manager = await TDStaff.findById(reportsTo);
    if (!manager) throw new ApiError(400, 'reportsTo manager not found');
    reportsToId = manager._id;
  }

  const doc = await TDStaff.create({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    password: String(password),
    designation: resolvedDesignation,
    role: resolveRole(resolvedDesignation, role),
    active: active !== false,
    allowedModules: modules || [],
    allowedActions: Array.isArray(allowedActions)
      ? allowedActions.map((a) => String(a).trim()).filter(Boolean)
      : [],
    reportsTo: reportsToId,
  });

  return successResponse(res, formatStaff(doc), 'User created', 201);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const doc = await TDStaff.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'User not found');

  const { name, email, password, designation, role, active, allowedModules, allowedActions, reportsTo } = req.body || {};
  if (name !== undefined) doc.name = String(name).trim();
  if (email !== undefined) doc.email = String(email).trim().toLowerCase();
  if (password) doc.password = String(password);
  if (designation !== undefined) {
    doc.designation = resolveDesignation(designation);
    doc.role = resolveRole(doc.designation, role);
  } else if (role !== undefined) {
    doc.role = resolveRole(doc.designation, role);
  }
  if (active !== undefined) doc.active = Boolean(active);
  const modules = sanitizeModules(allowedModules);
  if (modules !== undefined) doc.allowedModules = modules;
  if (Array.isArray(allowedActions)) {
    doc.allowedActions = allowedActions.map((a) => String(a).trim()).filter(Boolean);
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
  return successResponse(res, formatStaff(doc), 'User updated');
});

/**
 * Reveal a staff member's saved password (User Master "eye" feature).
 * Restricted to managers/superadmins. Users created before this feature
 * have no stored copy until a new password is set via Edit.
 */
exports.getUserPassword = asyncHandler(async (req, res) => {
  if (!['manager', 'superadmin'].includes(req.admin.role)) {
    throw new ApiError(403, 'Only managers and admins can view passwords');
  }

  const doc = await TDStaff.findById(req.params.id).select('+passwordPlain name email');
  if (!doc) throw new ApiError(404, 'User not found');

  return successResponse(res, {
    _id: doc._id,
    email: doc.email,
    password: doc.passwordPlain || null,
    available: Boolean(doc.passwordPlain),
  });
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
  if (!['manager', 'superadmin'].includes(req.admin.role)) {
    throw new ApiError(403, 'Only managers and admins can delete users');
  }

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

async function listAssignableStaff() {
  // Include custom positions added via User Master, not just the fixed hierarchy.
  const docs = await TDStaff.find({ active: true })
    .select('name email role designation reportsTo active')
    .sort({ designation: 1, name: 1 })
    .lean();

  return docs.map((row) => ({
    ...row,
    designationLabel: DESIGNATION_LABELS[row.designation] || row.designation,
  }));
}

exports.listAssignable = asyncHandler(async (req, res) => {
  const data = await listAssignableStaff();
  return successResponse(res, data);
});

exports.listAssignableStaff = listAssignableStaff;
