const StockRequisition = require('../models/StockRequisition');
const { REQUISITION_PRIORITIES, REQUISITION_STATUSES } = require('../models/StockRequisition');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { nextRequisitionNumber } = require('../utils/stockCounter');

function actorId(admin) {
  return admin?._id;
}

exports.listRequisitions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const q = {};
  if (req.query.status && req.query.status !== 'all') {
    q.status = String(req.query.status).trim().toUpperCase();
  }
  if (req.query.model) q.model = String(req.query.model).trim();
  if (req.query.priority) q.priority = String(req.query.priority).trim().toUpperCase();
  if (req.query.branchId) q.branchId = req.query.branchId;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ requisitionNo: rx }, { model: rx }, { variant: rx }, { colour: rx }, { remarks: rx }];
  }

  const [docs, total] = await Promise.all([
    StockRequisition.find(q)
      .populate('requestedBy', 'name email role designation')
      .populate('approvedBy', 'name email')
      .populate('branchId', 'name code')
      .populate('linkedPoId', 'poNumber status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockRequisition.countDocuments(q),
  ]);

  return successResponse(res, docs, undefined, 200, {
    page,
    limit,
    total,
    statuses: REQUISITION_STATUSES,
    priorities: REQUISITION_PRIORITIES,
  });
});

exports.createRequisition = asyncHandler(async (req, res) => {
  const model = String(req.body.model || '').trim();
  if (!model) throw new ApiError(400, 'Model is required');
  const qty = Math.max(1, Number(req.body.qty) || 1);
  const priority = String(req.body.priority || 'NORMAL').toUpperCase();
  if (!REQUISITION_PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of ${REQUISITION_PRIORITIES.join(', ')}`);
  }

  const doc = await StockRequisition.create({
    requisitionNo: await nextRequisitionNumber(),
    requestedBy: actorId(req.admin),
    model,
    variant: req.body.variant ? String(req.body.variant).trim() : undefined,
    colour: req.body.colour ? String(req.body.colour).trim() : undefined,
    qty,
    priority,
    neededBy: req.body.neededBy ? new Date(req.body.neededBy) : undefined,
    status: 'DRAFT',
    remarks: req.body.remarks,
    branchId: req.body.branchId || undefined,
    linkedPoId: req.body.linkedPoId || undefined,
  });

  await doc.populate([
    { path: 'requestedBy', select: 'name email role designation' },
    { path: 'branchId', select: 'name code' },
  ]);
  return successResponse(res, doc, 'Requisition created', 201);
});

exports.updateRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (!['DRAFT', 'SUBMITTED'].includes(doc.status)) {
    throw new ApiError(400, 'Only draft or submitted requisitions can be edited');
  }

  const fields = ['model', 'variant', 'colour', 'remarks', 'branchId', 'linkedPoId'];
  for (const f of fields) {
    if (req.body[f] !== undefined) doc[f] = req.body[f];
  }
  if (req.body.qty !== undefined) doc.qty = Math.max(1, Number(req.body.qty) || 1);
  if (req.body.priority !== undefined) {
    const priority = String(req.body.priority).toUpperCase();
    if (!REQUISITION_PRIORITIES.includes(priority)) {
      throw new ApiError(400, `priority must be one of ${REQUISITION_PRIORITIES.join(', ')}`);
    }
    doc.priority = priority;
  }
  if (req.body.neededBy !== undefined) {
    doc.neededBy = req.body.neededBy ? new Date(req.body.neededBy) : undefined;
  }
  await doc.save();
  await doc.populate([
    { path: 'requestedBy', select: 'name email role designation' },
    { path: 'branchId', select: 'name code' },
    { path: 'linkedPoId', select: 'poNumber status' },
  ]);
  return successResponse(res, doc, 'Requisition updated');
});

exports.submitRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (doc.status !== 'DRAFT') throw new ApiError(400, 'Only draft requisitions can be submitted');
  doc.status = 'SUBMITTED';
  doc.submittedAt = new Date();
  await doc.save();
  return successResponse(res, doc, 'Requisition submitted');
});

exports.approveRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (!['SUBMITTED', 'DRAFT'].includes(doc.status)) {
    throw new ApiError(400, 'Only submitted (or draft) requisitions can be approved');
  }
  doc.status = 'APPROVED';
  doc.approvedAt = new Date();
  doc.approvedBy = actorId(req.admin);
  if (!doc.submittedAt) doc.submittedAt = new Date();
  if (req.body.linkedPoId) doc.linkedPoId = req.body.linkedPoId;
  if (req.body.remarks) doc.remarks = req.body.remarks;
  await doc.save();
  await doc.populate([
    { path: 'requestedBy', select: 'name email' },
    { path: 'approvedBy', select: 'name email' },
    { path: 'linkedPoId', select: 'poNumber status' },
  ]);
  return successResponse(res, doc, 'Requisition approved');
});

exports.deleteRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (doc.status !== 'DRAFT') throw new ApiError(400, 'Only draft requisitions can be deleted');
  await doc.deleteOne();
  return successResponse(res, { _id: doc._id }, 'Requisition deleted');
});
