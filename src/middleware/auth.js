const Admin = require('../models/Admin');
const TDStaff = require('../models/TDStaff');
const ApiError = require('../utils/apiError');
const { verifyToken } = require('../utils/jwt');
const asyncHandler = require('../utils/asyncHandler');
const { DESIGNATION_LABELS } = require('../utils/tdBookingFormatter');

exports.protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid authorization token');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (decoded.userType === 'tdstaff') {
    const staff = await TDStaff.findById(decoded.id).select('-password');
    if (!staff || !staff.active) {
      throw new ApiError(401, 'Staff user not found or inactive');
    }
    req.tdStaff = staff;
    req.admin = {
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      designation: staff.designation,
      designationLabel: DESIGNATION_LABELS[staff.designation] || staff.designation,
      active: staff.active,
      allowedModules: Array.isArray(staff.allowedModules) ? staff.allowedModules : [],
    };
    return next();
  }

  const admin = await Admin.findById(decoded.id).select('-password');
  if (!admin || !admin.active) {
    throw new ApiError(401, 'Admin not found or inactive');
  }

  req.admin = admin;
  next();
});

exports.authorize = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return next(new ApiError(403, 'You are not allowed to perform this action'));
  }
  next();
};
