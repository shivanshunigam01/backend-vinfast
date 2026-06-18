require('../models/tdModels');

const TDCustomer = require('../models/TDCustomer');
const TestDrive = require('../models/TestDrive');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { normalizeMobile, mobileVariants, isValidIndianMobile } = require('../utils/mobile');
const { syncTestDriveToTdBooking, syncAllLegacyTestDrives } = require('../utils/tdBookingSync');
const { signCustomerToken } = require('../middleware/customerAuth');

const DEFAULT_OTP = process.env.CUSTOMER_LOGIN_DEFAULT_OTP || '4M0';

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

exports.login = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body || {};
  if (!otp) throw new ApiError(400, 'OTP is required');

  const customer = await resolveCustomerByMobile(mobile);
  const enteredOtp = String(otp).trim();

  if (enteredOtp !== DEFAULT_OTP) {
    throw new ApiError(400, 'Invalid OTP. Please try again.');
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
