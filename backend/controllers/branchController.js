const Branch = require('../models/Branch');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.getBranches = asyncHandler(async (req, res) => {
  const filter = req.query.active === 'true' ? { active: true } : {};
  const docs = await Branch.find(filter).sort({ name: 1 });
  res.json({ success: true, data: docs });
});

exports.getBranchById = asyncHandler(async (req, res) => {
  const doc = await Branch.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Branch not found');
  res.json({ success: true, data: doc });
});

exports.createBranch = asyncHandler(async (req, res) => {
  const doc = await Branch.create(req.body);
  res.status(201).json({ success: true, data: doc });
});

exports.updateBranch = asyncHandler(async (req, res) => {
  const doc = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'Branch not found');
  res.json({ success: true, data: doc });
});

exports.deleteBranch = asyncHandler(async (req, res) => {
  const doc = await Branch.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Branch not found');
  await doc.deleteOne();
  res.json({ success: true, message: 'Branch deleted' });
});
