const VehicleModel = require('../models/VehicleModel');
const TDVehicle = require('../models/TDVehicle');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { ensureVehicleCatalog, invalidateVehicleCatalogCache } = require('../utils/vehicleCatalog');

function formatModel(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: plain._id,
    name: plain.name,
    active: plain.active !== false,
    displayOrder: plain.displayOrder ?? 0,
    variants: (plain.variants || [])
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((v) => ({
        name: v.name,
        active: v.active !== false,
        displayOrder: v.displayOrder ?? 0,
      })),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function assertMasterDataRights(admin) {
  if (!['manager', 'superadmin'].includes(admin.role)) {
    throw new ApiError(403, 'Only managers and admins can manage the model master');
  }
}

/** Normalizes and validates the `variants` payload (array of strings or {name, active, displayOrder}). */
function parseVariants(raw) {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new ApiError(400, 'variants must be an array');
  const seen = new Set();
  const parsed = [];
  raw.forEach((entry, i) => {
    const name = String(typeof entry === 'object' && entry !== null ? entry.name : entry || '').trim();
    if (!name) throw new ApiError(400, `Variant #${i + 1} needs a name`);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new ApiError(400, `Duplicate variant "${name}"`);
    seen.add(key);
    parsed.push({
      name,
      active: typeof entry === 'object' && entry !== null ? entry.active !== false : true,
      displayOrder:
        typeof entry === 'object' && entry !== null && Number.isFinite(Number(entry.displayOrder))
          ? Number(entry.displayOrder)
          : i + 1,
    });
  });
  return parsed;
}

/** Public: active models with active variants, for website dropdowns. */
exports.getPublicCatalog = asyncHandler(async (req, res) => {
  await ensureVehicleCatalog();
  const docs = await VehicleModel.find({ active: true }).sort({ displayOrder: 1, name: 1 }).lean();
  const data = docs.map((doc) => ({
    name: doc.name,
    variants: (doc.variants || [])
      .filter((v) => v.active !== false)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((v) => v.name),
  }));
  return successResponse(res, data);
});

/** Admin: full list including inactive models/variants. */
exports.listModels = asyncHandler(async (req, res) => {
  await ensureVehicleCatalog();
  const docs = await VehicleModel.find().sort({ displayOrder: 1, name: 1 });
  return successResponse(res, docs.map(formatModel));
});

exports.createModel = asyncHandler(async (req, res) => {
  assertMasterDataRights(req.admin);
  const { name, displayOrder, active, variants } = req.body || {};

  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Model name is required');

  const existing = await VehicleModel.findOne({ name: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (existing) throw new ApiError(409, `Model "${existing.name}" already exists`);

  const count = await VehicleModel.countDocuments();
  const doc = await VehicleModel.create({
    name: trimmed,
    active: active !== false,
    displayOrder: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : count + 1,
    variants: parseVariants(variants) || [],
  });

  invalidateVehicleCatalogCache();
  return successResponse(res, formatModel(doc), 'Model created', 201);
});

exports.updateModel = asyncHandler(async (req, res) => {
  assertMasterDataRights(req.admin);
  const doc = await VehicleModel.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Model not found');

  const { name, displayOrder, active, variants } = req.body || {};
  const previousName = doc.name;

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(400, 'Model name cannot be empty');
    const clash = await VehicleModel.findOne({
      _id: { $ne: doc._id },
      name: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (clash) throw new ApiError(409, `Model "${clash.name}" already exists`);
    doc.name = trimmed;
  }
  if (displayOrder !== undefined && Number.isFinite(Number(displayOrder))) {
    doc.displayOrder = Number(displayOrder);
  }
  if (active !== undefined) doc.active = active !== false;

  const parsedVariants = parseVariants(variants);
  if (parsedVariants !== undefined) doc.variants = parsedVariants;

  await doc.save();

  // Keep demo-fleet tagging consistent when a model is renamed.
  if (doc.name !== previousName) {
    await TDVehicle.updateMany({ model: previousName }, { $set: { model: doc.name } });
  }

  invalidateVehicleCatalogCache();
  return successResponse(res, formatModel(doc), 'Model updated');
});

exports.deleteModel = asyncHandler(async (req, res) => {
  assertMasterDataRights(req.admin);
  const doc = await VehicleModel.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Model not found');

  const vehiclesUsing = await TDVehicle.countDocuments({ model: doc.name });
  if (vehiclesUsing > 0) {
    throw new ApiError(
      400,
      `${vehiclesUsing} demo vehicle(s) are tagged with "${doc.name}". Retag or remove them first, or mark the model inactive instead.`,
    );
  }

  await doc.deleteOne();
  invalidateVehicleCatalogCache();
  return successResponse(res, { _id: doc._id }, 'Model deleted');
});
