const LeadStage = require('../models/LeadStage');
const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const {
  listLeadStages,
  ensureDefaultLeadStages,
  invalidateLeadStageCache,
  slugifyKey,
} = require('../utils/leadStageService');
const { isCrmStaffRole } = require('../constants/leadStages');

function assertCrmAccess(admin) {
  if (!admin || !isCrmStaffRole(admin.role)) {
    throw new ApiError(403, 'CRM access required');
  }
}

function assertManager(admin) {
  assertCrmAccess(admin);
  if (!['superadmin', 'manager'].includes(admin.role) && admin.userType !== 'admin') {
    throw new ApiError(403, 'Manager access required to manage lead stages');
  }
}

exports.listStages = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const includeInactive = String(req.query.includeInactive || '') === '1' || req.query.includeInactive === 'true';
  // Management UI needs all stages; pipeline pickers use active-only via meta/stages.
  const canManage = ['superadmin', 'manager'].includes(req.admin.role) || req.admin.userType === 'admin';
  const docs = await listLeadStages({ includeInactive: includeInactive && canManage });
  return successResponse(res, docs);
});

exports.createStage = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  await ensureDefaultLeadStages();

  const label = String(req.body.label || '').trim();
  if (!label) throw new ApiError(400, 'Label is required');

  const key = String(req.body.key || slugifyKey(label)).trim().toLowerCase();
  if (!key) throw new ApiError(400, 'Key is required');

  const existing = await LeadStage.findOne({ $or: [{ key }, { label }] });
  if (existing) throw new ApiError(409, 'A stage with this key or label already exists');

  const maxOrder = await LeadStage.findOne().sort({ order: -1 }).select('order').lean();
  const order = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : (maxOrder?.order ?? 0) + 1;

  const doc = await LeadStage.create({
    key,
    label,
    order,
    color: req.body.color || 'bg-slate-500/15 text-slate-700',
    active: req.body.active !== false,
    isTerminal: Boolean(req.body.isTerminal),
    isLost: Boolean(req.body.isLost),
    systemProtected: false,
  });

  invalidateLeadStageCache();
  return successResponse(res, doc, 'Lead stage created', 201);
});

exports.updateStage = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  const doc = await LeadStage.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Lead stage not found');

  const { label, color, order, active, isTerminal, isLost } = req.body;

  if (label !== undefined) {
    const nextLabel = String(label).trim();
    if (!nextLabel) throw new ApiError(400, 'Label cannot be empty');
    if (nextLabel !== doc.label) {
      const clash = await LeadStage.findOne({ label: nextLabel, _id: { $ne: doc._id } });
      if (clash) throw new ApiError(409, 'Another stage already uses this label');
      // Rename historical lead statuses when label changes
      await Lead.updateMany({ status: doc.label }, { $set: { status: nextLabel } });
      doc.label = nextLabel;
    }
  }

  if (color !== undefined) doc.color = String(color).trim();
  if (order !== undefined && Number.isFinite(Number(order))) doc.order = Number(order);
  if (active !== undefined) {
    if (doc.systemProtected && active === false) {
      throw new ApiError(400, 'Protected system stages cannot be deactivated');
    }
    doc.active = Boolean(active);
  }
  if (isTerminal !== undefined && !doc.systemProtected) doc.isTerminal = Boolean(isTerminal);
  if (isLost !== undefined && !doc.systemProtected) doc.isLost = Boolean(isLost);

  await doc.save();
  invalidateLeadStageCache();
  return successResponse(res, doc, 'Lead stage updated');
});

exports.reorderStages = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds : [];
  if (!orderedIds.length) throw new ApiError(400, 'orderedIds array is required');

  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
  }));
  await LeadStage.bulkWrite(ops);
  invalidateLeadStageCache();
  const docs = await listLeadStages({ includeInactive: true });
  return successResponse(res, docs, 'Stages reordered');
});

exports.deleteStage = asyncHandler(async (req, res) => {
  assertManager(req.admin);
  const doc = await LeadStage.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Lead stage not found');
  if (doc.systemProtected) {
    throw new ApiError(400, 'Protected system stages cannot be deleted');
  }

  const inUse = await Lead.countDocuments({ status: doc.label });
  if (inUse > 0) {
    throw new ApiError(400, `Cannot delete: ${inUse} lead(s) still use this stage. Reassign them first.`);
  }

  await doc.deleteOne();
  invalidateLeadStageCache();
  return successResponse(res, null, 'Lead stage deleted');
});
