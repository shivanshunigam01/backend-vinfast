require('../models/tdModels');

const jwt = require('jsonwebtoken');
const TDCustomer = require('../models/TDCustomer');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { normalizeMobile, mobileVariants, isValidIndianMobile } = require('../utils/mobile');
const { syncTestDriveToTdBooking, syncAllLegacyTestDrives } = require('../utils/tdBookingSync');
const { signCustomerToken } = require('../middleware/customerAuth');

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

function toCustomerProfile(customer) {
  return {
    _id: customer._id,
    customerId: customer.customerId,
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email || null,
    city: customer.city || null,
  };
}

async function resolveCustomerByMobile(rawMobile) {
  const normalized = normalizeMobile(rawMobile);
  if (!isValidIndianMobile(normalized)) {
    throw new ApiError(400, 'Enter a valid 10-digit mobile number');
  }

  const variants = mobileVariants(normalized);

  let customer = await TDCustomer.findOne({ mobile: { $in: variants } });
  if (customer) return customer;

  const testDrive = await TestDrive.findOne({ mobile: { $in: variants } }).sort({ createdAt: -1 });
  if (!testDrive) {
    throw new ApiError(
      404,
      'No test drive found for this mobile number. Please submit a test drive booking first.',
    );
  }

  await syncAllLegacyTestDrives().catch(() => {});
  await syncTestDriveToTdBooking(testDrive);

  customer = await TDCustomer.findOne({ mobile: { $in: variants } });
  if (!customer) {
    customer = await TDCustomer.findOne({ mobile: testDrive.mobile });
  }
  if (!customer) {
    throw new ApiError(404, 'Could not link your test drive booking. Please contact the showroom.');
  }

  return customer;
}

exports.checkMobile = asyncHandler(async (req, res) => {
  const customer = await resolveCustomerByMobile(req.body.mobile);
  return successResponse(
    res,
    { name: customer.name, mobile: normalizeMobile(customer.mobile) },
    'Mobile number verified. Enter OTP to continue.',
  );
});

const CUSTOMER_LOGIN_FALLBACK_OTP = String(process.env.CUSTOMER_LOGIN_FALLBACK_OTP || '1234').trim();

exports.login = asyncHandler(async (req, res) => {
  const { mobile, whatsappVerificationToken, otp } = req.body || {};
  const customer = await resolveCustomerByMobile(mobile);
  const mobile10 = normalizeMobile(customer.mobile);

  const enteredOtp = String(otp || '').trim();
  const usedFallbackOtp = enteredOtp.length > 0 && enteredOtp === CUSTOMER_LOGIN_FALLBACK_OTP;

  // Accept either the WhatsApp verification JWT (same as test-drive) OR the fallback OTP.
  if (!usedFallbackOtp) {
    assertWhatsappVerificationToken(whatsappVerificationToken, mobile10);
  }

  const token = signCustomerToken(customer);

  return res.status(200).json({
    success: true,
    token,
    customer: toCustomerProfile(customer),
    message: 'Logged in successfully',
  });
});

exports.me = asyncHandler(async (req, res) => {
  return res.status(200).json({ success: true, customer: toCustomerProfile(req.customer) });
});
