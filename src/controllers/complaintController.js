const CustomerComplaint = require('../models/CustomerComplaint');
const {
  COMPLAINT_DIRECTIONS,
  COMPLAINT_STATUSES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_CHANNELS,
} = require('../models/CustomerComplaint');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { nextComplaintNumber } = require('../utils/stockCounter');

function normalizeDirection(value) {
  const d = String(value || '').trim().toUpperCase();
  if (!COMPLAINT_DIRECTIONS.includes(d)) {
    throw new ApiError(400, `direction must be one of ${COMPLAINT_DIRECTIONS.join(', ')}`);
  }
  return d;
}

function normalizeMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new ApiError(400, 'Valid 10-digit mobile is required');
  }
  return digits;
}

function actorName(admin) {
  return admin?.name || admin?.email || 'Staff';
}

exports.listComplaints = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};

  if (req.query.direction) {
    query.direction = normalizeDirection(req.query.direction);
  }
  if (req.query.status && req.query.status !== 'all') {
    const status = String(req.query.status).trim().toUpperCase();
    if (!COMPLAINT_STATUSES.includes(status)) {
      throw new ApiError(400, `status must be one of ${COMPLAINT_STATUSES.join(', ')}`);
    }
    query.status = status;
  }
  if (req.query.priority && req.query.priority !== 'all') {
    query.priority = String(req.query.priority).trim().toUpperCase();
  }
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { complaintNo: rx },
      { customerName: rx },
      { mobile: rx },
      { subject: rx },
      { description: rx },
      { category: rx },
    ];
  }

  const [docs, total] = await Promise.all([
    CustomerComplaint.find(query)
      .populate('assignedTo', 'name email designation')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CustomerComplaint.countDocuments(query),
  ]);

  return successResponse(res, docs, undefined, 200, {
    page,
    limit,
    total,
    directions: COMPLAINT_DIRECTIONS,
    statuses: COMPLAINT_STATUSES,
    priorities: COMPLAINT_PRIORITIES,
    channels: COMPLAINT_CHANNELS,
  });
});

exports.getComplaint = asyncHandler(async (req, res) => {
  const doc = await CustomerComplaint.findById(req.params.id)
    .populate('assignedTo', 'name email designation')
    .populate('createdBy', 'name email')
    .populate('leadId', 'leadId opportunityId name mobile status model')
    .lean();
  if (!doc) throw new ApiError(404, 'Complaint not found');
  return successResponse(res, doc);
});

exports.createComplaint = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const direction = normalizeDirection(body.direction);
  const customerName = String(body.customerName || '').trim();
  if (customerName.length < 2) throw new ApiError(400, 'Customer name is required');
  const mobile = normalizeMobile(body.mobile);
  const subject = String(body.subject || '').trim();
  if (!subject) throw new ApiError(400, 'Subject is required');

  const priority = String(body.priority || 'MEDIUM').trim().toUpperCase();
  if (!COMPLAINT_PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of ${COMPLAINT_PRIORITIES.join(', ')}`);
  }

  const description = body.description ? String(body.description).trim() : '';
  const doc = await CustomerComplaint.create({
    complaintNo: await nextComplaintNumber(),
    direction,
    customerName,
    mobile,
    email: body.email ? String(body.email).trim().toLowerCase() : undefined,
    subject,
    description,
    category: body.category ? String(body.category).trim() : undefined,
    channel: body.channel ? String(body.channel).trim() : 'Phone',
    status: 'OPEN',
    priority,
    model: body.model ? String(body.model).trim() : undefined,
    leadId: body.leadId || undefined,
    assignedTo: body.assignedTo || req.admin._id,
    assignedToName: body.assignedToName || actorName(req.admin),
    createdBy: req.admin._id,
    communications: description
      ? [
          {
            at: new Date(),
            direction,
            note: description,
            by: req.admin._id,
            byName: actorName(req.admin),
          },
        ]
      : [],
  });

  await doc.populate([
    { path: 'assignedTo', select: 'name email designation' },
    { path: 'createdBy', select: 'name email' },
  ]);
  return successResponse(res, doc, 'Complaint logged', 201);
});

exports.updateComplaint = asyncHandler(async (req, res) => {
  const doc = await CustomerComplaint.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Complaint not found');

  const body = req.body || {};
  if (body.customerName != null) {
    const name = String(body.customerName).trim();
    if (name.length < 2) throw new ApiError(400, 'Customer name is required');
    doc.customerName = name;
  }
  if (body.mobile != null) doc.mobile = normalizeMobile(body.mobile);
  if (body.email != null) doc.email = String(body.email).trim().toLowerCase() || undefined;
  if (body.subject != null) {
    const subject = String(body.subject).trim();
    if (!subject) throw new ApiError(400, 'Subject is required');
    doc.subject = subject;
  }
  if (body.description != null) doc.description = String(body.description).trim();
  if (body.category != null) doc.category = String(body.category).trim() || undefined;
  if (body.channel != null) doc.channel = String(body.channel).trim() || 'Phone';
  if (body.model != null) doc.model = String(body.model).trim() || undefined;
  if (body.assignedTo != null) doc.assignedTo = body.assignedTo || undefined;
  if (body.assignedToName != null) doc.assignedToName = String(body.assignedToName).trim() || undefined;
  if (body.resolution != null) doc.resolution = String(body.resolution).trim() || undefined;

  if (body.priority != null) {
    const priority = String(body.priority).trim().toUpperCase();
    if (!COMPLAINT_PRIORITIES.includes(priority)) {
      throw new ApiError(400, `priority must be one of ${COMPLAINT_PRIORITIES.join(', ')}`);
    }
    doc.priority = priority;
  }

  if (body.status != null) {
    const status = String(body.status).trim().toUpperCase();
    if (!COMPLAINT_STATUSES.includes(status)) {
      throw new ApiError(400, `status must be one of ${COMPLAINT_STATUSES.join(', ')}`);
    }
    doc.status = status;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      doc.resolvedAt = doc.resolvedAt || new Date();
    } else {
      doc.resolvedAt = undefined;
    }
  }

  doc.updatedBy = req.admin._id;
  await doc.save();
  await doc.populate([
    { path: 'assignedTo', select: 'name email designation' },
    { path: 'createdBy', select: 'name email' },
  ]);
  return successResponse(res, doc, 'Complaint updated');
});

exports.addCommunication = asyncHandler(async (req, res) => {
  const doc = await CustomerComplaint.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Complaint not found');

  const note = String(req.body?.note || '').trim();
  if (!note) throw new ApiError(400, 'Communication note is required');
  const direction = req.body?.direction
    ? normalizeDirection(req.body.direction)
    : doc.direction;

  doc.communications.push({
    at: new Date(),
    direction,
    note,
    by: req.admin._id,
    byName: actorName(req.admin),
  });

  if (req.body?.status) {
    const status = String(req.body.status).trim().toUpperCase();
    if (!COMPLAINT_STATUSES.includes(status)) {
      throw new ApiError(400, `status must be one of ${COMPLAINT_STATUSES.join(', ')}`);
    }
    doc.status = status;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      doc.resolvedAt = doc.resolvedAt || new Date();
    }
  } else if (doc.status === 'OPEN') {
    doc.status = 'IN_PROGRESS';
  }

  doc.updatedBy = req.admin._id;
  await doc.save();
  await doc.populate([
    { path: 'assignedTo', select: 'name email designation' },
    { path: 'createdBy', select: 'name email' },
  ]);
  return successResponse(res, doc, 'Communication added');
});

exports.deleteComplaint = asyncHandler(async (req, res) => {
  const doc = await CustomerComplaint.findByIdAndDelete(req.params.id);
  if (!doc) throw new ApiError(404, 'Complaint not found');
  return successResponse(res, { _id: doc._id }, 'Complaint deleted');
});
