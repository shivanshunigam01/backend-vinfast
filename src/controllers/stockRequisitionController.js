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

function actorName(admin) {
  return admin?.name || admin?.email || 'System';
}

function pushApproval(doc, action, status, admin, remarks) {
  doc.approvalHistory.push({
    action,
    status,
    by: actorId(admin),
    byName: actorName(admin),
    remarks,
  });
}

function assertNotSelfApproval(doc, admin, actionLabel) {
  if (!admin || admin.role === 'superadmin' || admin.userType === 'admin') return;
  const requesterId = String(doc.requestedBy?._id || doc.requestedBy || '');
  const actor = String(actorId(admin) || '');
  if (requesterId && actor && requesterId === actor) {
    throw new ApiError(403, `You cannot ${actionLabel} your own requisition`);
  }
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
      .populate('recommendedBy', 'name email')
      .populate('branchId', 'name code')
      .populate('linkedPoId', 'poNumber status externalPoNumber')
      .populate('linkedPoIds', 'poNumber status externalPoNumber')
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
    receivingLocation: req.body.receivingLocation ? String(req.body.receivingLocation).trim() : undefined,
    purpose: req.body.purpose ? String(req.body.purpose).trim() : undefined,
    justification: req.body.justification ? String(req.body.justification).trim() : undefined,
    indicativeAmount: req.body.indicativeAmount != null ? Number(req.body.indicativeAmount) : undefined,
    planReference: req.body.planReference ? String(req.body.planReference).trim() : undefined,
    status: 'DRAFT',
    remarks: req.body.remarks,
    branchId: req.body.branchId || undefined,
    version: 1,
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
  if (!['DRAFT', 'RETURNED', 'SUBMITTED'].includes(doc.status)) {
    throw new ApiError(400, 'Only draft, returned or submitted requisitions can be edited');
  }

  const fields = [
    'model', 'variant', 'colour', 'remarks', 'branchId', 'receivingLocation',
    'purpose', 'justification', 'planReference',
  ];
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
  if (req.body.indicativeAmount !== undefined) {
    doc.indicativeAmount = req.body.indicativeAmount != null ? Number(req.body.indicativeAmount) : undefined;
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
  if (!['DRAFT', 'RETURNED'].includes(doc.status)) {
    throw new ApiError(400, 'Only draft or returned requisitions can be submitted');
  }
  if (!doc.model || !doc.qty) throw new ApiError(400, 'Model and quantity are required before submit');
  doc.status = 'SUBMITTED';
  doc.submittedAt = new Date();
  pushApproval(doc, 'SUBMIT', 'SUBMITTED', req.admin, req.body?.remarks);
  await doc.save();
  return successResponse(res, doc, 'Requisition submitted for Sales Head recommendation');
});

exports.recommendRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (doc.status !== 'SUBMITTED') {
    throw new ApiError(400, 'Only submitted requisitions can be recommended');
  }
  assertNotSelfApproval(doc, req.admin, 'recommend');
  doc.status = 'PENDING_MD';
  doc.recommendedAt = new Date();
  doc.recommendedBy = actorId(req.admin);
  pushApproval(doc, 'RECOMMEND', 'PENDING_MD', req.admin, req.body?.remarks);
  await doc.save();
  return successResponse(res, doc, 'Requisition recommended to MD for approval');
});

exports.returnRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (!['SUBMITTED', 'PENDING_MD'].includes(doc.status)) {
    throw new ApiError(400, 'Only submitted or pending MD requisitions can be returned');
  }
  const remarks = String(req.body?.remarks || '').trim();
  if (!remarks) throw new ApiError(400, 'Return comment is required');
  doc.status = 'RETURNED';
  doc.version = (doc.version || 1) + 1;
  pushApproval(doc, 'RETURN', 'RETURNED', req.admin, remarks);
  await doc.save();
  return successResponse(res, doc, 'Requisition returned to planner');
});

exports.rejectRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (!['SUBMITTED', 'PENDING_MD'].includes(doc.status)) {
    throw new ApiError(400, 'Only submitted or pending MD requisitions can be rejected');
  }
  const remarks = String(req.body?.remarks || '').trim();
  if (!remarks) throw new ApiError(400, 'Rejection reason is required');
  assertNotSelfApproval(doc, req.admin, 'reject');
  doc.status = 'REJECTED';
  pushApproval(doc, 'REJECT', 'REJECTED', req.admin, remarks);
  await doc.save();
  return successResponse(res, doc, 'Requisition rejected');
});

exports.approveRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (doc.status !== 'PENDING_MD') {
    throw new ApiError(400, 'Only requisitions pending MD approval can be approved');
  }
  assertNotSelfApproval(doc, req.admin, 'approve');
  doc.status = 'APPROVED';
  doc.approvedAt = new Date();
  doc.approvedBy = actorId(req.admin);
  pushApproval(doc, 'APPROVE', 'APPROVED', req.admin, req.body?.remarks);
  await doc.save();
  await doc.populate([
    { path: 'requestedBy', select: 'name email' },
    { path: 'approvedBy', select: 'name email' },
    { path: 'recommendedBy', select: 'name email' },
  ]);
  return successResponse(res, doc, 'Requisition approved — ready for external PO entry');
});

exports.deleteRequisition = asyncHandler(async (req, res) => {
  const doc = await StockRequisition.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Requisition not found');
  if (doc.status !== 'DRAFT') throw new ApiError(400, 'Only draft requisitions can be deleted');
  await doc.deleteOne();
  return successResponse(res, { _id: doc._id }, 'Requisition deleted');
});
