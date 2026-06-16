const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { normalizeMobile, mobileVariants, isValidIndianMobile } = require('../utils/mobile');
const { syncTestDriveToTDBooking, syncUnlinkedTestDrives } = require('../utils/syncTestDriveBooking');

const DEFAULT_OTP = process.env.CUSTOMER_LOGIN_DEFAULT_OTP || '4M0';

const signCustomerToken = (customer) => jwt.sign(
  { id: customer._id, type: 'customer' },
  process.env.JWT_SECRET,
  { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '7d' }
);

function toCustomerProfile(customer) {
  return {
    _id: customer._id,
    customerId: customer.customerId,
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email || null,
    city: customer.city || null
  };
}

async function resolveCustomerByMobile(rawMobile) {
  const normalized = normalizeMobile(rawMobile);
  if (!isValidIndianMobile(normalized)) {
    throw new ApiError(400, 'Enter a valid 10-digit mobile number');
  }

  const variants = mobileVariants(normalized);

  let customer = await Customer.findOne({ mobile: { $in: variants } });
  if (customer) return customer;

  const testDrive = await TestDrive.findOne({ mobile: { $in: variants } }).sort({ createdAt: -1 });
  if (!testDrive) {
    throw new ApiError(
      404,
      'No test drive found for this mobile number. Please submit a test drive booking first.'
    );
  }

  await syncUnlinkedTestDrives();
  await syncTestDriveToTDBooking(testDrive);

  customer = await Customer.findOne({ mobile: { $in: variants } });
  if (!customer) {
    customer = await Customer.findOne({ mobile: testDrive.mobile });
  }
  if (!customer) {
    throw new ApiError(404, 'Could not link your test drive booking. Please contact the showroom.');
  }

  return customer;
}

/** POST /api/v1/customer/auth/check-mobile */
exports.checkMobile = asyncHandler(async (req, res) => {
  const customer = await resolveCustomerByMobile(req.body.mobile);
  res.json({
    success: true,
    message: 'Mobile number verified. Enter OTP to continue.',
    data: { name: customer.name, mobile: normalizeMobile(customer.mobile) }
  });
});

/** POST /api/v1/customer/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  if (!otp) throw new ApiError(400, 'OTP is required');

  const customer = await resolveCustomerByMobile(mobile);
  const enteredOtp = String(otp).trim();

  if (enteredOtp !== DEFAULT_OTP) {
    throw new ApiError(400, 'Invalid OTP. Please try again.');
  }

  const token = signCustomerToken(customer);

  res.json({
    success: true,
    token,
    customer: toCustomerProfile(customer),
    message: 'Logged in successfully'
  });
});

/** GET /api/v1/customer/auth/me */
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, customer: toCustomerProfile(req.customer) });
});
