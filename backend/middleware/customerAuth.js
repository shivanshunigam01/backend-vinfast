const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.customerProtect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authorized. Please log in.');
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.type !== 'customer') {
    throw new ApiError(401, 'Invalid customer session.');
  }

  const customer = await Customer.findById(decoded.id);
  if (!customer || !customer.active) {
    throw new ApiError(401, 'Customer account not found or inactive.');
  }

  req.customer = customer;
  next();
});
