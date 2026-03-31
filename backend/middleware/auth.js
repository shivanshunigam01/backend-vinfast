const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authorized. No token.');
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const admin = await Admin.findById(decoded.id).select('-password');
  if (!admin || !admin.active) {
    throw new ApiError(401, 'Admin not found or inactive.');
  }

  req.admin = admin;
  next();
});

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin.role)) {
    return next(new ApiError(403, 'Access denied. Insufficient role.'));
  }
  next();
};
