const cloudinary = require('../config/cloudinary');
const MediaItem = require('../models/MediaItem');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.getMedia = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.tag) query.tag = req.query.tag;
  const docs = await MediaItem.find(query).populate('uploadedBy', 'name email role').sort({ createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.createMedia = asyncHandler(async (req, res) => {
  const doc = await MediaItem.create({ ...req.body, uploadedBy: req.admin._id });
  res.status(201).json({ success: true, data: await doc.populate('uploadedBy', 'name email role') });
});

exports.deleteMedia = asyncHandler(async (req, res) => {
  const item = await MediaItem.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Media not found');

  if (item.publicId && process.env.CLOUDINARY_CLOUD_NAME) {
    await cloudinary.uploader.destroy(item.publicId);
  }

  await item.deleteOne();
  res.json({ success: true, message: 'Media deleted successfully' });
});
