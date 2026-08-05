const Admin = require('../models/Admin');
const TDStaff = require('../models/TDStaff');
const { DESIGNATION_LABELS } = require('../utils/tdBookingFormatter');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { signToken } = require('../utils/jwt');

function staffLoginPayload(staff) {
  return {
    _id: staff._id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    designation: staff.designation,
    designationLabel: DESIGNATION_LABELS[staff.designation] || staff.designation,
    allowedModules: Array.isArray(staff.allowedModules) ? staff.allowedModules : [],
    allowedActions: Array.isArray(staff.allowedActions) ? staff.allowedActions : [],
    userType: 'tdstaff',
  };
}

function adminLoginPayload(admin) {
  return {
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    userType: 'admin',
  };
}

/**
 * Tells the user they picked the wrong portal instead of a generic credential
 * error. Only triggers when the credentials are actually valid on the other
 * portal, so it cannot be used to enumerate accounts.
 */
async function assertNotWrongPortal(Model, normalizedEmail, password, message) {
  const other = await Model.findOne({ email: normalizedEmail }).select('+password');
  if (!other) return;
  const matches = await other.comparePassword(password).catch(() => false);
  if (!matches) return;
  if (!other.active) {
    throw new ApiError(403, 'This account is deactivated. Ask an admin to activate it.');
  }
  throw new ApiError(403, message);
}

/** Admin portal login — Admin accounts only. */
exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');
  const adminMatches = admin ? await admin.comparePassword(password).catch(() => false) : false;
  if (!adminMatches) {
    await assertNotWrongPortal(
      TDStaff,
      normalizedEmail,
      password,
      'This is an Employee account. Please sign in from the Employee portal (Employee Login) instead.',
    );
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!admin.active) {
    throw new ApiError(403, 'This account is deactivated. Ask an admin to activate it.');
  }

  const token = signToken({ id: admin._id, role: admin.role, userType: 'admin' });
  return res.status(200).json({
    success: true,
    token,
    admin: adminLoginPayload(admin),
  });
});

/** Staff portal login — TDStaff accounts only. */
exports.staffLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const staff = await TDStaff.findOne({ email: normalizedEmail }).select('+password');
  const staffMatches = staff ? await staff.comparePassword(password).catch(() => false) : false;
  if (!staffMatches) {
    await assertNotWrongPortal(
      Admin,
      normalizedEmail,
      password,
      'This is an Admin account. Please sign in from the Admin portal (Login as admin) instead.',
    );
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!staff.active) {
    throw new ApiError(403, 'This account is deactivated. Ask an admin to activate it.');
  }

  const token = signToken({ id: staff._id, role: staff.role, userType: 'tdstaff' });
  return res.status(200).json({
    success: true,
    token,
    admin: staffLoginPayload(staff),
  });
});

/**
 * Legacy shared login kept for backward compatibility.
 * Prefer /auth/login (admin) and /auth/staff-login (staff).
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const [staff, admin] = await Promise.all([
    TDStaff.findOne({ email: normalizedEmail }).select('+password'),
    Admin.findOne({ email: normalizedEmail }).select('+password'),
  ]);

  const staffOk = Boolean(staff?.active && (await staff.comparePassword(password)));
  const adminOk = Boolean(admin?.active && (await admin.comparePassword(password)));

  if (!staffOk && !adminOk) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isFieldExecutive =
    staffOk &&
    (staff.role === 'executive' ||
      staff.designation === 'sales_executive' ||
      staff.designation === 'cre');

  if (isFieldExecutive) {
    const token = signToken({ id: staff._id, role: staff.role, userType: 'tdstaff' });
    return res.status(200).json({ success: true, token, admin: staffLoginPayload(staff) });
  }

  if (adminOk) {
    const token = signToken({ id: admin._id, role: admin.role, userType: 'admin' });
    return res.status(200).json({
      success: true,
      token,
      admin: adminLoginPayload(admin),
    });
  }

  const token = signToken({ id: staff._id, role: staff.role, userType: 'tdstaff' });
  return res.status(200).json({ success: true, token, admin: staffLoginPayload(staff) });
});

exports.me = asyncHandler(async (req, res) => successResponse(res, req.admin));

/** Update own profile (name only). Email, role, designation, and ACL stay admin-managed. */
exports.updateProfile = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    throw new ApiError(400, 'Name is required');
  }
  if (name.length > 120) {
    throw new ApiError(400, 'Name must be 120 characters or fewer');
  }

  if (req.admin.userType === 'tdstaff') {
    const staff = await TDStaff.findById(req.admin._id);
    if (!staff || !staff.active) {
      throw new ApiError(401, 'Staff user not found or inactive');
    }
    staff.name = name;
    await staff.save();
    return successResponse(res, staffLoginPayload(staff), 'Profile updated');
  }

  const admin = await Admin.findById(req.admin._id);
  if (!admin || !admin.active) {
    throw new ApiError(401, 'Admin not found or inactive');
  }
  admin.name = name;
  await admin.save();
  return successResponse(res, adminLoginPayload(admin), 'Profile updated');
});

/** Change own password — requires current password. */
exports.changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }

  const isStaff = req.admin.userType === 'tdstaff';
  const minLen = isStaff ? 8 : 6;
  if (newPassword.length < minLen) {
    throw new ApiError(400, `New password must be at least ${minLen} characters`);
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from the current password');
  }

  if (isStaff) {
    const staff = await TDStaff.findById(req.admin._id).select('+password +passwordPlain');
    if (!staff || !staff.active) {
      throw new ApiError(401, 'Staff user not found or inactive');
    }
    const matches = await staff.comparePassword(currentPassword);
    if (!matches) {
      throw new ApiError(400, 'Current password is incorrect');
    }
    staff.password = newPassword;
    staff.markModified('password');
    await staff.save();
    return successResponse(res, { ok: true }, 'Password updated');
  }

  const admin = await Admin.findById(req.admin._id).select('+password');
  if (!admin || !admin.active) {
    throw new ApiError(401, 'Admin not found or inactive');
  }
  const matches = await admin.comparePassword(currentPassword);
  if (!matches) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  admin.password = newPassword;
  admin.markModified('password');
  await admin.save();
  return successResponse(res, { ok: true }, 'Password updated');
});
