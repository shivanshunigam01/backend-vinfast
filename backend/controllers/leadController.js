const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

exports.createLead = asyncHandler(async (req, res) => {
  const lead = await Lead.create(req.body);
  res.status(201).json({
    success: true,
    message: 'Thank you! Our EV advisor will contact you within 10 minutes.',
    leadId: lead._id
  });
});

exports.getLeads = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};

  if (req.query.status) query.status = req.query.status;
  if (req.query.model) query.model = req.query.model;
  if (req.query.source) query.source = req.query.source;
  if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
  if (req.query.from || req.query.to) {
    query.createdAt = {};
    if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) query.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }
  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), 'i');
    query.$or = [{ name: regex }, { mobile: regex }, { email: regex }, { city: regex }, { remarks: regex }];
  }

  const [docs, total] = await Promise.all([
    Lead.find(query).populate('assignedTo', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Lead.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getLeadById = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email role');
  if (!lead) throw new ApiError(404, 'Lead not found');
  res.json({ success: true, data: lead });
});

exports.updateLead = asyncHandler(async (req, res) => {
  if (req.body.assignedTo) {
    const exists = await Admin.findById(req.body.assignedTo);
    if (!exists) throw new ApiError(404, 'Assigned admin not found');
  }

  const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('assignedTo', 'name email role');

  if (!lead) throw new ApiError(404, 'Lead not found');
  res.json({ success: true, data: lead });
});

exports.deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  await lead.deleteOne();
  res.json({ success: true, message: 'Lead deleted successfully' });
});
