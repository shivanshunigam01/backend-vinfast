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

/** Admin portal login — Admin accounts only. */
exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');
  if (!admin?.active || !(await admin.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
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
  if (!staff?.active || !(await staff.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
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
