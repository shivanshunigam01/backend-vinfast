const Banner = require('../models/Banner');
const FAQ = require('../models/FAQ');
const Testimonial = require('../models/Testimonial');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const notFound = (name) => new ApiError(404, `${name} not found`);

exports.getPublicBanners = asyncHandler(async (req, res) => {
  const docs = await Banner.find({ active: true }).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.getPublicFaqs = asyncHandler(async (req, res) => {
  const query = { active: true };
  if (req.query.category) query.category = req.query.category;
  const docs = await FAQ.find(query).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.getPublicTestimonials = asyncHandler(async (req, res) => {
  const docs = await Testimonial.find({ active: true }).sort({ createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.getBanners = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Banner.find().sort({ order: 1, createdAt: -1 }) });
});

exports.createBanner = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await Banner.create(req.body) });
});

exports.updateBanner = asyncHandler(async (req, res) => {
  const doc = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw notFound('Banner');
  res.json({ success: true, data: doc });
});

exports.deleteBanner = asyncHandler(async (req, res) => {
  const doc = await Banner.findById(req.params.id);
  if (!doc) throw notFound('Banner');
  await doc.deleteOne();
  res.json({ success: true, message: 'Banner deleted successfully' });
});

exports.getFaqs = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await FAQ.find().sort({ order: 1, createdAt: -1 }) });
});

exports.createFaq = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await FAQ.create(req.body) });
});

exports.updateFaq = asyncHandler(async (req, res) => {
  const doc = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw notFound('FAQ');
  res.json({ success: true, data: doc });
});

exports.deleteFaq = asyncHandler(async (req, res) => {
  const doc = await FAQ.findById(req.params.id);
  if (!doc) throw notFound('FAQ');
  await doc.deleteOne();
  res.json({ success: true, message: 'FAQ deleted successfully' });
});

exports.getTestimonials = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Testimonial.find().sort({ createdAt: -1 }) });
});

exports.createTestimonial = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await Testimonial.create(req.body) });
});

exports.updateTestimonial = asyncHandler(async (req, res) => {
  const doc = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw notFound('Testimonial');
  res.json({ success: true, data: doc });
});

exports.deleteTestimonial = asyncHandler(async (req, res) => {
  const doc = await Testimonial.findById(req.params.id);
  if (!doc) throw notFound('Testimonial');
  await doc.deleteOne();
  res.json({ success: true, message: 'Testimonial deleted successfully' });
});
