require('../models/tdModels');

const jwt = require('jsonwebtoken');
const TDCustomer = require('../models/TDCustomer');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { verifyToken } = require('../utils/jwt');

exports.customerProtect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authorized. Please log in.');
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }

  if (decoded.type !== 'customer') {
    throw new ApiError(401, 'Invalid customer session.');
  }

  const customer = await TDCustomer.findById(decoded.id);
  if (!customer) {
    throw new ApiError(401, 'Customer account not found.');
  }

  req.customer = customer;
  next();
});

exports.signCustomerToken = (customer) =>
  jwt.sign(
    { id: customer._id, type: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '7d' },
  );
