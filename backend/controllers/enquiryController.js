const Enquiry = require('../models/Enquiry');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

exports.createEnquiry = asyncHandler(async (req, res) => {
  await Enquiry.create(req.body);
  res.status(201).json({
    success: true,
    message: "We've received your enquiry and will respond within 24 hours."
  });
});

exports.getEnquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.type) query.type = req.query.type;

  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), 'i');
    query.$or = [{ name: regex }, { mobile: regex }, { email: regex }, { city: regex }, { model: regex }, { message: regex }];
  }

  const [docs, total] = await Promise.all([
    Enquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Enquiry.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getEnquiryById = asyncHandler(async (req, res) => {
  const item = await Enquiry.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Enquiry not found');
  res.json({ success: true, data: item });
});

exports.updateEnquiry = asyncHandler(async (req, res) => {
  const item = await Enquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, 'Enquiry not found');
  res.json({ success: true, data: item });
});

exports.deleteEnquiry = asyncHandler(async (req, res) => {
  const item = await Enquiry.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Enquiry not found');
  await item.deleteOne();
  res.json({ success: true, message: 'Enquiry deleted successfully' });
});
