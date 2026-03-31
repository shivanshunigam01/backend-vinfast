const HeroSlide = require('../models/HeroSlide');
const SiteConfig = require('../models/SiteConfig');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const CONFIG_KEYS = ['whatsappNumber', 'phoneNumber', 'vf7Price', 'vf6Price', 'vf7Range', 'vf6Range', 'leadStripTitle', 'leadStripSubtitle'];

const fetchConfigObject = async () => {
  const rows = await SiteConfig.find({ key: { $in: CONFIG_KEYS } });
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
};

exports.getPublicHeroSlides = asyncHandler(async (req, res) => {
  const docs = await HeroSlide.find({ active: true }).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.getAdminSlides = asyncHandler(async (req, res) => {
  const docs = await HeroSlide.find().sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.createSlide = asyncHandler(async (req, res) => {
  const doc = await HeroSlide.create(req.body);
  res.status(201).json({ success: true, data: doc });
});

exports.updateSlide = asyncHandler(async (req, res) => {
  const doc = await HeroSlide.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'Hero slide not found');
  res.json({ success: true, data: doc });
});

exports.deleteSlide = asyncHandler(async (req, res) => {
  const doc = await HeroSlide.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Hero slide not found');
  await doc.deleteOne();
  res.json({ success: true, message: 'Hero slide deleted successfully' });
});

exports.getPublicConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await fetchConfigObject() });
});

exports.getAdminConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await fetchConfigObject() });
});

exports.updateConfig = asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body).filter(([key]) => CONFIG_KEYS.includes(key));
  await Promise.all(entries.map(([key, value]) =>
    SiteConfig.findOneAndUpdate({ key }, { key, value }, { new: true, upsert: true, setDefaultsOnInsert: true })
  ));
  res.json({ success: true, message: 'Configuration updated successfully' });
});
