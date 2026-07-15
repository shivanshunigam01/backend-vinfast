require('../models/tdModels');

const VehicleStock = require('../models/VehicleStock');
const { STOCK_STATUSES, BATTERY_STATUSES } = require('../models/VehicleStock');
const VehicleModel = require('../models/VehicleModel');
const TDVehicle = require('../models/TDVehicle');
const TDBooking = require('../models/TDBooking');
const Counter = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { getActiveModelNames } = require('../utils/vehicleCatalog');

async function nextStockId() {
  const doc = await Counter.findOneAndUpdate(
    { key: 'vehicle_stock' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `STK${String(doc.seq).padStart(4, '0')}`;
}

function assertStockEditRights(admin) {
  if (!['manager', 'superadmin'].includes(admin.role)) {
    throw new ApiError(403, 'Only managers and admins can manage vehicle stock');
  }
}

/** Model must exist in the master catalog; variant (if any) must belong to it. */
async function assertCatalogModelVariant(model, variant) {
  const models = await getActiveModelNames();
  if (!models.includes(model)) {
    throw new ApiError(400, `Unknown model "${model}". Add it under Model Master first.`);
  }
  const trimmedVariant = String(variant || '').trim();
  if (!trimmedVariant) return;
  const doc = await VehicleModel.findOne({ name: model }).lean();
  const variantNames = (doc?.variants || []).filter((v) => v.active !== false).map((v) => v.name);
  if (variantNames.length && !variantNames.includes(trimmedVariant)) {
    throw new ApiError(
      400,
      `"${trimmedVariant}" is not a variant of ${model}. Valid variants: ${variantNames.join(', ')}`,
    );
  }
}

function formatStock(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const branch = plain.branchId && typeof plain.branchId === 'object' ? plain.branchId : null;
  const demoVehicle = plain.demoVehicleId && typeof plain.demoVehicleId === 'object' ? plain.demoVehicleId : null;
  return {
    _id: plain._id,
    stockId: plain.stockId,
    model: plain.model,
    variant: plain.variant || null,
    colour: plain.colour || null,
    vinNo: plain.vinNo,
    registrationNo: plain.registrationNo || null,
    batteryPercent: plain.batteryPercent ?? null,
    batteryStatus: plain.batteryStatus || 'OK',
    location: plain.location || null,
    status: plain.status,
    isDemo: Boolean(plain.isDemo),
    demoVehicleId: demoVehicle
      ? { _id: demoVehicle._id, vehicleId: demoVehicle.vehicleId, status: demoVehicle.status }
      : plain.demoVehicleId || null,
    branchId: branch ? { _id: branch._id, name: branch.name, code: branch.code } : plain.branchId || null,
    remarks: plain.remarks || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

const STOCK_POPULATE = [
  { path: 'branchId', select: 'name code' },
  { path: 'demoVehicleId', select: 'vehicleId status' },
];

exports.listStock = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);

  const query = {};
  if (req.query.status && req.query.status !== 'all') {
    query.status = String(req.query.status).trim().toUpperCase();
  }
  if (req.query.model && req.query.model !== 'all') query.model = String(req.query.model).trim();
  if (req.query.demo === 'true') query.isDemo = true;
  if (req.query.demo === 'false') query.isDemo = false;
  if (req.query.search) {
    const regex = new RegExp(String(req.query.search).trim(), 'i');
    query.$or = [
      { stockId: regex },
      { vinNo: regex },
      { registrationNo: regex },
      { model: regex },
      { variant: regex },
      { colour: regex },
      { location: regex },
    ];
  }

  const [docs, total, statusCounts] = await Promise.all([
    VehicleStock.find(query).populate(STOCK_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    VehicleStock.countDocuments(query),
    VehicleStock.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return successResponse(res, docs.map(formatStock), undefined, 200, {
    page,
    limit,
    total,
    statuses: STOCK_STATUSES,
    batteryStatuses: BATTERY_STATUSES,
    byStatus: Object.fromEntries(statusCounts.map((r) => [r._id, r.count])),
  });
});

exports.getStock = asyncHandler(async (req, res) => {
  const doc = await VehicleStock.findById(req.params.id).populate(STOCK_POPULATE);
  if (!doc) throw new ApiError(404, 'Stock item not found');
  return successResponse(res, formatStock(doc));
});

exports.createStock = asyncHandler(async (req, res) => {
  assertStockEditRights(req.admin);
  const body = req.body || {};

  const model = String(body.model || '').trim();
  await assertCatalogModelVariant(model, body.variant);

  const vinNo = String(body.vinNo || '').trim().toUpperCase();
  if (!vinNo) throw new ApiError(400, 'VIN/chassis number is required');
  const existing = await VehicleStock.findOne({ vinNo });
  if (existing) throw new ApiError(409, `A stock entry with VIN ${vinNo} already exists (${existing.stockId})`);

  const doc = await VehicleStock.create({
    stockId: await nextStockId(),
    model,
    variant: body.variant ? String(body.variant).trim() : undefined,
    colour: body.colour ? String(body.colour).trim() : undefined,
    vinNo,
    registrationNo: body.registrationNo ? String(body.registrationNo).trim().toUpperCase() : undefined,
    batteryPercent: body.batteryPercent != null ? Number(body.batteryPercent) : 100,
    batteryStatus: body.batteryStatus || 'OK',
    location: body.location ? String(body.location).trim() : undefined,
    status: body.status && STOCK_STATUSES.includes(String(body.status).toUpperCase())
      ? String(body.status).toUpperCase()
      : 'FRESH_STOCK',
    branchId: body.branchId || undefined,
    remarks: body.remarks ? String(body.remarks).trim() : undefined,
    createdBy: req.admin._id,
  });

  await doc.populate(STOCK_POPULATE);
  return successResponse(res, formatStock(doc), 'Vehicle added to stock', 201);
});

exports.updateStock = asyncHandler(async (req, res) => {
  assertStockEditRights(req.admin);
  const doc = await VehicleStock.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Stock item not found');

  const body = req.body || {};

  if (body.model !== undefined) doc.model = String(body.model).trim();
  if (body.variant !== undefined) doc.variant = String(body.variant).trim() || undefined;
  if (body.model !== undefined || body.variant !== undefined) {
    await assertCatalogModelVariant(doc.model, doc.variant);
  }

  if (body.vinNo !== undefined) {
    const vinNo = String(body.vinNo).trim().toUpperCase();
    if (!vinNo) throw new ApiError(400, 'VIN/chassis number cannot be empty');
    const clash = await VehicleStock.findOne({ vinNo, _id: { $ne: doc._id } });
    if (clash) throw new ApiError(409, `Another stock entry already uses VIN ${vinNo} (${clash.stockId})`);
    doc.vinNo = vinNo;
  }

  if (body.colour !== undefined) doc.colour = String(body.colour).trim() || undefined;
  if (body.registrationNo !== undefined) {
    doc.registrationNo = String(body.registrationNo).trim().toUpperCase() || undefined;
  }
  if (body.batteryPercent !== undefined) doc.batteryPercent = Number(body.batteryPercent);
  if (body.batteryStatus !== undefined) doc.batteryStatus = body.batteryStatus;
  if (body.location !== undefined) doc.location = String(body.location).trim() || undefined;
  if (body.remarks !== undefined) doc.remarks = String(body.remarks).trim() || undefined;
  if (body.branchId !== undefined) doc.branchId = body.branchId || undefined;
  if (body.status !== undefined) {
    const next = String(body.status).toUpperCase();
    if (!STOCK_STATUSES.includes(next)) {
      throw new ApiError(400, `Invalid status. Use one of: ${STOCK_STATUSES.join(', ')}`);
    }
    if (doc.isDemo && next !== 'DEMO') {
      throw new ApiError(400, 'Untag the demo vehicle first, then change the stock status');
    }
    doc.status = next;
  }

  await doc.save();

  // Keep the linked demo fleet record in sync with editable fields.
  if (doc.isDemo && doc.demoVehicleId) {
    await TDVehicle.updateOne(
      { _id: doc.demoVehicleId },
      {
        $set: {
          model: doc.model,
          variant: doc.variant,
          color: doc.colour,
          vinNo: doc.vinNo,
          registrationNo: doc.registrationNo,
          ...(body.batteryPercent !== undefined ? { batteryPercent: doc.batteryPercent } : {}),
          ...(body.branchId !== undefined ? { branchId: doc.branchId } : {}),
        },
      },
    );
  }

  await doc.populate(STOCK_POPULATE);
  return successResponse(res, formatStock(doc), 'Stock updated');
});

/**
 * Tag/untag a stock unit as a demo vehicle. Tagging creates a TDVehicle so it
 * becomes selectable in the test-drive module; untagging removes it (only when
 * it has no bookings).
 */
exports.tagDemo = asyncHandler(async (req, res) => {
  assertStockEditRights(req.admin);
  const doc = await VehicleStock.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Stock item not found');

  const makeDemo = req.body?.demo !== false;

  if (makeDemo) {
    if (doc.isDemo && doc.demoVehicleId) {
      throw new ApiError(400, 'This vehicle is already tagged as a demo vehicle');
    }
    if (doc.status === 'SOLD') throw new ApiError(400, 'A sold vehicle cannot be tagged as demo');

    const vehicle = await TDVehicle.create({
      vehicleId: doc.stockId,
      model: doc.model,
      variant: doc.variant,
      registrationNo: doc.registrationNo,
      vinNo: doc.vinNo,
      color: doc.colour,
      batteryPercent: doc.batteryPercent ?? 100,
      status: 'AVAILABLE',
      branchId: doc.branchId || undefined,
    });

    doc.isDemo = true;
    doc.demoVehicleId = vehicle._id;
    doc.status = 'DEMO';
    await doc.save();
    await doc.populate(STOCK_POPULATE);
    return successResponse(res, formatStock(doc), 'Tagged as demo vehicle — now available in the test drive module');
  }

  // Untag
  if (!doc.isDemo) throw new ApiError(400, 'This vehicle is not tagged as a demo vehicle');

  if (doc.demoVehicleId) {
    const inUse = await TDBooking.countDocuments({ vehicleId: doc.demoVehicleId });
    if (inUse > 0) {
      const vehicle = await TDVehicle.findById(doc.demoVehicleId);
      if (vehicle && ['RUNNING', 'BOOKED'].includes(vehicle.status)) {
        throw new ApiError(409, 'This demo vehicle has an active booking/test drive — free it up first');
      }
      // Keep the historical fleet record (it has test-drive history) but park it.
      if (vehicle) {
        vehicle.status = 'REPAIR';
        vehicle.isLocked = true;
        await vehicle.save();
      }
    } else {
      await TDVehicle.deleteOne({ _id: doc.demoVehicleId });
    }
  }

  doc.isDemo = false;
  doc.demoVehicleId = undefined;
  doc.status = 'FRESH_STOCK';
  await doc.save();
  await doc.populate(STOCK_POPULATE);
  return successResponse(res, formatStock(doc), 'Demo tag removed — vehicle returned to fresh stock');
});

exports.deleteStock = asyncHandler(async (req, res) => {
  if (req.admin.role !== 'superadmin') {
    throw new ApiError(403, 'Only admins can delete stock entries');
  }
  const doc = await VehicleStock.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Stock item not found');
  if (doc.isDemo) throw new ApiError(400, 'Untag the demo vehicle before deleting this stock entry');
  await doc.deleteOne();
  return successResponse(res, { _id: doc._id }, 'Stock entry deleted');
});
