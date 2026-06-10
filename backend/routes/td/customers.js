const express = require('express');
const ctrl = require('../../controllers/customerController');
const { protect, authorize } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const jwt = require('jsonwebtoken');
const Customer = require('../../models/Customer');

// Middleware: authenticate customer JWT
const customerAuth = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) throw new ApiError(401, 'Not authorized');
  const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
  if (decoded.type !== 'customer') throw new ApiError(401, 'Invalid token type');
  const customer = await Customer.findById(decoded.id);
  if (!customer || !customer.active) throw new ApiError(401, 'Customer not found');
  req.customer = customer;
  next();
});

const router = express.Router();

// Public customer routes (OTP auth)
router.post('/send-otp', ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);

// Authenticated customer routes
router.get('/me', customerAuth, ctrl.getProfile);
router.put('/me', customerAuth, ctrl.updateProfile);
router.post('/license', customerAuth, ctrl.uploadLicense);

// Admin routes
router.get('/', protect, ctrl.listCustomers);
router.put('/:id/verify-license', protect, authorize('superadmin', 'manager'), ctrl.verifyLicense);

module.exports = { router, customerAuth };
