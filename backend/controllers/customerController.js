const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const DrivingLicense = require('../models/DrivingLicense');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Generate a 6-digit OTP (stored in plain for demo; hash in production)
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const signCustomerToken = (id) =>
  jwt.sign({ id, type: 'customer' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN || '30d'
  });

// POST /customer/send-otp
exports.sendOtp = asyncHandler(async (req, res) => {
  const { mobile, name } = req.body;
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new ApiError(400, 'Valid 10-digit mobile number is required');
  }

  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  let customer = await Customer.findOne({ mobile });
  if (!customer) {
    if (!name) throw new ApiError(400, 'Name is required for new customers');
    customer = new Customer({ mobile, name });
  }
  customer.otp = otp;
  customer.otpExpiry = otpExpiry;
  customer.otpAttempts = 0;
  await customer.save();

  // In production: send via SMS/WhatsApp gateway
  console.log(`[OTP] Sending OTP ${otp} to ${mobile}`);

  res.json({
    success: true,
    message: 'OTP sent to your mobile number',
    ...(process.env.NODE_ENV === 'development' && { otp }) // expose only in dev
  });
});

// POST /customer/verify-otp
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  const customer = await Customer.findOne({ mobile }).select('+otp +otpExpiry +otpAttempts');
  if (!customer) throw new ApiError(404, 'Customer not found');

  if (customer.otpAttempts >= 5) throw new ApiError(429, 'Too many OTP attempts. Request a new OTP.');
  if (!customer.otp || customer.otpExpiry < new Date()) throw new ApiError(400, 'OTP expired. Request a new OTP.');
  if (customer.otp !== String(otp)) {
    customer.otpAttempts += 1;
    await customer.save();
    throw new ApiError(400, 'Invalid OTP');
  }

  customer.otp = undefined;
  customer.otpExpiry = undefined;
  customer.otpAttempts = 0;
  customer.isVerified = true;
  await customer.save();

  const license = await DrivingLicense.findOne({ customerId: customer._id });

  res.json({
    success: true,
    token: signCustomerToken(customer._id),
    customer: {
      _id: customer._id,
      customerId: customer.customerId,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      profileComplete: customer.profileComplete
    },
    hasLicense: !!license,
    licenseStatus: license?.verificationStatus || null
  });
});

// GET /customer/me
exports.getProfile = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.customer._id);
  const license = await DrivingLicense.findOne({ customerId: customer._id }).select('-__v');
  res.json({ success: true, data: { customer, license } });
});

// PUT /customer/me
exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'city', 'state', 'dateOfBirth'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  updates.profileComplete = !!(updates.name || req.customer.name) && !!(updates.email || req.customer.email);

  const doc = await Customer.findByIdAndUpdate(req.customer._id, updates, { new: true, runValidators: true });
  res.json({ success: true, data: doc });
});

// POST /customer/license
exports.uploadLicense = asyncHandler(async (req, res) => {
  const { licenseNumber, holderName, dateOfBirth, issueDate, expiryDate,
    issuingAuthority, vehicleClasses, frontImageUrl, backImageUrl } = req.body;

  if (!licenseNumber || !holderName || !dateOfBirth || !issueDate || !expiryDate) {
    throw new ApiError(400, 'License number, holder name, DOB, issue date, and expiry date are required');
  }

  const expiry = new Date(expiryDate);
  if (expiry < new Date()) throw new ApiError(400, 'Driving license is expired. Please renew it before booking a test drive.');

  const existing = await DrivingLicense.findOne({ customerId: req.customer._id });
  if (existing) {
    Object.assign(existing, { licenseNumber, holderName, dateOfBirth, issueDate, expiryDate, issuingAuthority, vehicleClasses, frontImageUrl, backImageUrl, verificationStatus: 'Pending' });
    await existing.save();
    return res.json({ success: true, message: 'License updated. Pending admin verification.', data: existing });
  }

  const doc = await DrivingLicense.create({
    customerId: req.customer._id,
    licenseNumber, holderName, dateOfBirth, issueDate, expiryDate,
    issuingAuthority, vehicleClasses, frontImageUrl, backImageUrl
  });
  res.status(201).json({ success: true, message: 'License submitted. Pending admin verification.', data: doc });
});

// GET /admin/td/customers — admin list
exports.listCustomers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const query = {};
  if (search) {
    const r = new RegExp(search.trim(), 'i');
    query.$or = [{ name: r }, { mobile: r }, { email: r }, { customerId: r }];
  }
  const [docs, total] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Customer.countDocuments(query)
  ]);
  res.json({ success: true, total, data: docs });
});

// PUT /admin/td/customers/:id/verify-license
exports.verifyLicense = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!['Verified', 'Rejected'].includes(status)) throw new ApiError(400, 'Status must be Verified or Rejected');

  const license = await DrivingLicense.findOne({ customerId: req.params.id });
  if (!license) throw new ApiError(404, 'License not found for this customer');

  license.verificationStatus = status;
  license.verifiedBy = req.admin._id;
  license.verifiedAt = new Date();
  if (status === 'Rejected') license.rejectionReason = rejectionReason;
  await license.save();

  res.json({ success: true, message: `License ${status.toLowerCase()}`, data: license });
});
