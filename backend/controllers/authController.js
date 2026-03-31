const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const signToken = (admin) => jwt.sign(
  { id: admin._id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email: email.toLowerCase().trim(), active: true }).select('+password');

  if (!admin || !(await admin.matchPassword(password))) {
    throw new ApiError(401, 'Invalid credentials');
  }

  res.json({
    success: true,
    token: signToken(admin),
    admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role }
  });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, admin: req.admin });
});
