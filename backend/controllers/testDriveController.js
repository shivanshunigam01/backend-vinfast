const TestDrive = require('../models/TestDrive');
const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

exports.createTestDrive = asyncHandler(async (req, res) => {
  const booking = await TestDrive.create(req.body);
  res.status(201).json({
    success: true,
    message: "Test drive booked! We'll confirm your slot within 2 hours.",
    bookingId: booking._id
  });
});

exports.getTestDrives = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.model) query.model = req.query.model;
  if (req.query.date) {
    const date = new Date(req.query.date);
    const next = new Date(req.query.date);
    next.setDate(next.getDate() + 1);
    query.preferredDate = { $gte: date, $lt: next };
  }

  const [docs, total] = await Promise.all([
    TestDrive.find(query).populate('assignedExecutive', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(limit),
    TestDrive.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getTestDriveById = asyncHandler(async (req, res) => {
  const item = await TestDrive.findById(req.params.id).populate('assignedExecutive', 'name email role');
  if (!item) throw new ApiError(404, 'Test drive not found');
  res.json({ success: true, data: item });
});

exports.updateTestDrive = asyncHandler(async (req, res) => {
  if (req.body.assignedExecutive) {
    const exists = await Admin.findById(req.body.assignedExecutive);
    if (!exists) throw new ApiError(404, 'Assigned executive not found');
  }

  const item = await TestDrive.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('assignedExecutive', 'name email role');

  if (!item) throw new ApiError(404, 'Test drive not found');
  res.json({ success: true, data: item });
});

exports.deleteTestDrive = asyncHandler(async (req, res) => {
  const item = await TestDrive.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Test drive not found');
  await item.deleteOne();
  res.json({ success: true, message: 'Test drive deleted successfully' });
});
