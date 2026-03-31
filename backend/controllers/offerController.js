const Offer = require('../models/Offer');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.getPublicOffers = asyncHandler(async (req, res) => {
  const query = { active: true };
  if (req.query.model) query.$or = [{ model: req.query.model }, { model: 'All Models' }];
  const docs = await Offer.find(query).sort({ createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.getAdminOffers = asyncHandler(async (req, res) => {
  const docs = await Offer.find().sort({ createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.createOffer = asyncHandler(async (req, res) => {
  const doc = await Offer.create(req.body);
  res.status(201).json({ success: true, data: doc });
});

exports.updateOffer = asyncHandler(async (req, res) => {
  const doc = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'Offer not found');
  res.json({ success: true, data: doc });
});

exports.deleteOffer = asyncHandler(async (req, res) => {
  const doc = await Offer.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Offer not found');
  await doc.deleteOne();
  res.json({ success: true, message: 'Offer deleted successfully' });
});
