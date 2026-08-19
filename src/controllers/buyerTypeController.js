const BuyerType = require('../models/BuyerType');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const {
  listBuyerTypes,
  ensureDefaultBuyerTypes,
  invalidateBuyerTypeCache,
  slugifyKey,
} = require('../utils/buyerTypeService');
const { isCrmStaffRole } = require('../constants/leadStages');

function assertCrmAccess(admin) {
  if (admin?.userType === 'admin') return;
  if (!admin || !isCrmStaffRole(admin.role)) {
    throw new ApiError(403, 'CRM access required');
  }
}

function assertManager(admin) {
  assertCrmAccess(admin);
  if (!['superadmin', 'manager'].includes(admin.role) && admin.userType !== 'admin') {
    throw new ApiError(403, 'Manager access required to manage buyer types');
  }
}

exports.listBuyerTypes = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const includeInactive = String(req.query.includeInactive || '') === '1' || req.query.includeInactive === 'true';
  const canManage = ['superadmin', 'manager'].includes(req.admin.role) || req.admin.userType === 'admin';
  const docs = await listBuyerTypes({ includeInactive: includeInactive && canManage });
  return successResponse(res, docs);
});

exports.createBuyerType = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  await ensureDefaultBuyerTypes();
  const label = String(req.body.label || '').trim();
  if (!label) throw new ApiError(400, 'Label is required');
  const key = String(req.body.key || slugifyKey(label)).trim().toLowerCase();
  const existing = await BuyerType.findOne({ $or: [{ key }, { label }] });
  if (existing) throw new ApiError(409, 'A buyer type with this key or label already exists');
  const maxOrder = await BuyerType.findOne().sort({ order: -1 }).select('order').lean();
  const doc = await BuyerType.create({
    key,
    label,
    order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : (maxOrder?.order ?? 0) + 1,
    active: req.body.active !== false,
    systemProtected: false,
  });
  invalidateBuyerTypeCache();
  return successResponse(res, doc, 'Buyer type created', 201);
});

exports.updateBuyerType = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  const doc = await BuyerType.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Buyer type not found');
  const { label, order, active } = req.body;
  if (label !== undefined) {
    const nextLabel = String(label).trim();
    if (!nextLabel) throw new ApiError(400, 'Label cannot be empty');
    doc.label = nextLabel;
  }
  if (order !== undefined) doc.order = Number(order);
  if (active !== undefined) doc.active = Boolean(active);
  await doc.save();
  invalidateBuyerTypeCache();
  return successResponse(res, doc, 'Buyer type updated');
});

exports.deleteBuyerType = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  const doc = await BuyerType.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Buyer type not found');
  if (doc.systemProtected) throw new ApiError(400, 'Protected buyer types cannot be deleted');
  await BuyerType.deleteOne({ _id: doc._id });
  invalidateBuyerTypeCache();
  return successResponse(res, { _id: doc._id }, 'Buyer type deleted');
});

exports.reorderBuyerTypes = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) throw new ApiError(400, 'ids array is required');
  await Promise.all(ids.map((id, i) => BuyerType.updateOne({ _id: id }, { $set: { order: i + 1 } })));
  invalidateBuyerTypeCache();
  const docs = await listBuyerTypes({ includeInactive: true });
  return successResponse(res, docs, 'Order saved');
});
