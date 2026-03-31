const slugify = require('slugify');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.getPublicProducts = asyncHandler(async (req, res) => {
  const docs = await Product.find({ active: true }).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.getPublicProductBySlug = asyncHandler(async (req, res) => {
  const doc = await Product.findOne({ slug: req.params.slug.toLowerCase(), active: true });
  if (!doc) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: doc });
});

exports.getAdminProducts = asyncHandler(async (req, res) => {
  const docs = await Product.find().sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  payload.slug = slugify(payload.slug || payload.name, { lower: true, strict: true });
  const doc = await Product.create(payload);
  res.status(201).json({ success: true, data: doc });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.slug || payload.name) {
    payload.slug = slugify(payload.slug || payload.name, { lower: true, strict: true });
  }
  const doc = await Product.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: doc });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const doc = await Product.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Product not found');
  await doc.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});
