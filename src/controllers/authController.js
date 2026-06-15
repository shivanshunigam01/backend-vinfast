const Admin = require('../models/Admin');
const TDStaff = require('../models/TDStaff');
const { DESIGNATION_LABELS } = require('../utils/tdBookingFormatter');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { signToken } = require('../utils/jwt');

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');
  if (admin && admin.active && (await admin.comparePassword(password))) {
    const token = signToken({ id: admin._id, role: admin.role, userType: 'admin' });
    const safeAdmin = {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
    return res.status(200).json({ success: true, token, admin: safeAdmin });
  }

  const staff = await TDStaff.findOne({ email: normalizedEmail }).select('+password');
  if (staff && staff.active && (await staff.comparePassword(password))) {
    const token = signToken({ id: staff._id, role: staff.role, userType: 'tdstaff' });
    const safeAdmin = {
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      designation: staff.designation,
      designationLabel: DESIGNATION_LABELS[staff.designation] || staff.designation,
    };
    return res.status(200).json({ success: true, token, admin: safeAdmin });
  }

  throw new ApiError(401, 'Invalid email or password');
});

exports.me = asyncHandler(async (req, res) => successResponse(res, req.admin));
