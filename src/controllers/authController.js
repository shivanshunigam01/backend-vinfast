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
      'This is a Staff account. Please sign in from the Staff portal (Login as staff) instead.',
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
    staffOk && (staff.role === 'executive' || staff.designation === 'sales_executive');

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
