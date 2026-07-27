const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { normalizeMobile, mobileVariants, isValidIndianMobile } = require('../utils/mobile');
const { syncTestDriveToTDBooking, syncUnlinkedTestDrives } = require('../utils/syncTestDriveBooking');

/** Customer login is WhatsApp-OTP only — verified via the wa_otp token issued after code verify. */
function assertWhatsappVerificationToken(token, mobile10) {
  if (!token || typeof token !== 'string') {
    throw new ApiError(400, 'Please verify your mobile number with the WhatsApp code first.');
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== 'wa_otp' || payload.mobile !== mobile10) {
      throw new Error('bad');
    }
  } catch {
    throw new ApiError(400, 'WhatsApp verification expired or invalid. Please request a new code.');
  }
}

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
  const { mobile, whatsappVerificationToken } = req.body;

  const customer = await resolveCustomerByMobile(mobile);
  assertWhatsappVerificationToken(whatsappVerificationToken, normalizeMobile(customer.mobile));

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
