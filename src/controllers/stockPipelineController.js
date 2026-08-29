const PurchaseOrder = require('../models/PurchaseOrder');
const Dispatch = require('../models/Dispatch');
const GateEntry = require('../models/GateEntry');
const Grn = require('../models/Grn');
const ReceiptVerification = require('../models/ReceiptVerification');
const StockPdi = require('../models/StockPdi');
const Rectification = require('../models/Rectification');
const VehicleHold = require('../models/VehicleHold');
const StockMovement = require('../models/StockMovement');
const VehicleChargingLog = require('../models/VehicleChargingLog');
const VehicleDiagnostic = require('../models/VehicleDiagnostic');
const VehicleDocument = require('../models/VehicleDocument');
const VehicleAllocation = require('../models/VehicleAllocation');
const VehicleStock = require('../models/VehicleStock');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const {
  nextPoNumber, nextDispatchNumber, nextGateEntryNumber, nextGrnNumber,
  nextReceiptNumber, nextPdiNumber, nextRectificationNumber, nextStockId,
} = require('../utils/stockCounter');
const { logAudit, logStatusChange, listAuditLogs } = require('../services/auditService');
const {
  assertPoTransition, transitionVehicleStatus, compareConfig,
  computeAgeingBucket, computeStockAgeDays, assertAvailableForAllocation,
  mapVehicleStatusToLegacy,
} = require('../services/vehicleLifecycleService');
const { cloudinaryConfigured, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');
const { getOrCreateConfig } = require('./stockConfigController');

function actorId(admin) {
  return admin?._id;
}

function actorName(admin) {
  return admin?.name || admin?.email || 'System';
}

async function recordMovement(stock, { fromStatus, toStatus, fromLocation, toLocation, admin, remarks }) {
  return StockMovement.create({
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    fromStatus,
    toStatus,
    fromLocation: fromLocation || stock.location,
    toLocation: toLocation || stock.location,
    fromYard: stock.yardName,
    toYard: stock.yardName,
    remarks,
    movedBy: actorId(admin),
  });
}

async function uploadPhotos(files, folder) {
  if (!files?.length) return [];
  if (!cloudinaryConfigured()) throw new ApiError(503, 'Photo upload not configured (Cloudinary)');
  const out = [];
  for (const f of files) {
    const r = await uploadBufferToCloudinary(f.buffer, { folder: `patliputra-vinfast/stock/${folder}` });
    out.push({ label: f.fieldname, url: r.secure_url, publicId: r.public_id });
  }
  return out;
}

function normalizePoLines(lines) {
  return (lines || []).map((l) => ({
    model: String(l.model || '').trim(),
    variant: String(l.variant || '').trim() || undefined,
    colour: String(l.colour || '').trim() || undefined,
    interiorColour: String(l.interiorColour || '').trim() || undefined,
    batteryConfig: String(l.batteryConfig || '').trim() || undefined,
    modelYear: l.modelYear ? Number(l.modelYear) : undefined,
    qty: Math.max(1, Number(l.qty) || 1),
    receivedQty: Number(l.receivedQty) || 0,
    basicPrice: Number(l.basicPrice) || 0,
    gstAmount: Number(l.gstAmount) || 0,
    freight: Number(l.freight) || 0,
    discount: Number(l.discount) || 0,
  }));
}

function applyPoHeader(doc, body) {
  if (body.poDate) doc.poDate = new Date(body.poDate);
  if (body.poType) doc.poType = body.poType;
  if (body.supplier) doc.supplier = body.supplier;
  if (body.deliveryLocation) doc.deliveryLocation = body.deliveryLocation;
  if (body.deliveryLocationId) doc.deliveryLocationId = body.deliveryLocationId;
  if (body.paymentTerms) doc.paymentTerms = body.paymentTerms;
  if (body.fundingBank !== undefined) doc.fundingBank = body.fundingBank;
  if (body.requestedDeliveryDate) doc.requestedDeliveryDate = new Date(body.requestedDeliveryDate);
  if (body.oemCommittedDate) doc.oemCommittedDate = new Date(body.oemCommittedDate);
  if (body.expectedDate) doc.expectedDate = new Date(body.expectedDate);
  if (body.bookingLinked != null) doc.bookingLinked = Boolean(body.bookingLinked);
  if (body.bookingNumber) doc.bookingNumber = body.bookingNumber;
  if (body.leadId) doc.leadId = body.leadId;
  if (body.remarks !== undefined) doc.remarks = body.remarks;
  if (body.lines) doc.lines = normalizePoLines(body.lines);
}

function pushApproval(doc, action, status, admin, remarks) {
  doc.approvalHistory.push({
    action, status, by: actorId(admin), byName: actorName(admin), remarks,
  });
}

/* ─── Purchase Orders ─────────────────────────────────────────────── */

exports.listPurchaseOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};
  if (req.query.status) query.status = String(req.query.status).toUpperCase();
  const [docs, total] = await Promise.all([
    PurchaseOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PurchaseOrder.countDocuments(query),
  ]);
  return successResponse(res, docs, undefined, 200, { page, limit, total });
});

exports.getPurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  return successResponse(res, doc);
});

exports.createPurchaseOrder = asyncHandler(async (req, res) => {
  const lines = normalizePoLines(req.body?.lines);
  if (!lines.length) throw new ApiError(400, 'Provide at least one PO line');
  if (lines.some((l) => !l.model)) throw new ApiError(400, 'Each line needs a model');
  if (req.body?.bookingLinked && !req.body?.bookingNumber) {
    throw new ApiError(400, 'bookingNumber required when bookingLinked is true');
  }
  const doc = new PurchaseOrder({
    poNumber: await nextPoNumber(),
    status: 'DRAFT',
    supplier: req.body?.supplier || 'VinFast',
    createdBy: actorId(req.admin),
  });
  applyPoHeader(doc, req.body);
  await doc.save();
  return successResponse(res, doc, 'Purchase order created', 201);
});

exports.updatePurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  if (doc.locked || !['DRAFT', 'SUBMITTED', 'REJECTED'].includes(doc.status)) {
    throw new ApiError(400, 'PO cannot be edited in current status');
  }
  applyPoHeader(doc, req.body);
  await doc.save();
  return successResponse(res, doc, 'Purchase order updated');
});

exports.submitPurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  assertPoTransition(doc.status, 'SUBMITTED');
  doc.status = 'SUBMITTED';
  pushApproval(doc, 'SUBMIT', 'SUBMITTED', req.admin, req.body?.remarks);
  await doc.save();
  return successResponse(res, doc, 'PO submitted for approval');
});

exports.approvePurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  assertPoTransition(doc.status, 'APPROVED');
  doc.status = 'APPROVED';
  pushApproval(doc, 'APPROVE', 'APPROVED', req.admin, req.body?.remarks);
  await doc.save();
  return successResponse(res, doc, 'PO approved');
});

exports.rejectPurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  assertPoTransition(doc.status, 'REJECTED');
  doc.status = 'REJECTED';
  pushApproval(doc, 'REJECT', 'REJECTED', req.admin, req.body?.remarks);
  await doc.save();
  return successResponse(res, doc, 'PO rejected');
});

exports.releasePurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  assertPoTransition(doc.status, 'RELEASED');
  doc.status = 'RELEASED';
  doc.locked = true;
  doc.releasedAt = new Date();
  doc.raisedAt = doc.raisedAt || new Date();
  pushApproval(doc, 'RELEASE', 'RELEASED', req.admin, req.body?.remarks);
  await doc.save();
  return successResponse(res, doc, 'PO released');
});

exports.cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  assertPoTransition(doc.status, 'CANCELLED');
  doc.status = 'CANCELLED';
  pushApproval(doc, 'CANCEL', 'CANCELLED', req.admin, req.body?.remarks);
  await doc.save();
  return successResponse(res, doc, 'PO cancelled');
});

/* ─── Dispatch ────────────────────────────────────────────────────── */

exports.listDispatches = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.poId) query.purchaseOrderId = req.query.poId;
  const [docs, total] = await Promise.all([
    Dispatch.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('purchaseOrderId', 'poNumber status').lean(),
    Dispatch.countDocuments(query),
  ]);
  return successResponse(res, docs, undefined, 200, { page, limit, total });
});

exports.createDispatch = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.body?.purchaseOrderId || req.params.poId);
  if (!po) throw new ApiError(404, 'Purchase order not found');
  if (!['RELEASED', 'PART_SUPPLIED'].includes(po.status)) {
    throw new ApiError(400, 'PO must be RELEASED or PART_SUPPLIED to create dispatch');
  }
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) throw new ApiError(400, 'Provide at least one VIN in dispatch');

  const createdStocks = [];
  const dispatchItems = [];

  for (const item of items) {
    const vin = String(item.vin || '').trim().toUpperCase();
    if (!vin) throw new ApiError(400, 'Each item needs vin');
    const exists = await VehicleStock.findOne({ vinNo: vin });
    if (exists) throw new ApiError(409, `Duplicate VIN ${vin} (AC-01)`);

    let poLine;
    if (item.poLineId) {
      poLine = po.lines.id(item.poLineId);
      if (!poLine) throw new ApiError(400, `Invalid PO line id ${item.poLineId}`);
    } else {
      poLine = po.lines.find(
        (l) => l.model === item.model &&
          (!item.variant || l.variant === item.variant) &&
          (!item.colour || l.colour === item.colour),
      ) || po.lines.find((l) => l.model === item.model);
    }
    if (!poLine) throw new ApiError(400, `No PO line for model ${item.model}`);

    const dispatched = Number(poLine.dispatchedQty) || 0;
    if (dispatched >= poLine.qty) {
      throw new ApiError(400, `PO line ${poLine.model}${poLine.variant ? ` ${poLine.variant}` : ''} already fully dispatched (${poLine.qty}/${poLine.qty})`);
    }

    const match = compareConfig(
      { model: poLine.model, variant: poLine.variant, colour: poLine.colour, batteryConfig: poLine.batteryConfig },
      { model: item.model, variant: item.variant, colour: item.colour, batteryConfig: item.batteryConfig },
    );

    const stock = await VehicleStock.create({
      stockId: await nextStockId(),
      model: item.model || poLine.model,
      variant: item.variant || poLine.variant,
      colour: item.colour || poLine.colour,
      batteryConfig: item.batteryConfig || poLine.batteryConfig,
      interiorColour: poLine.interiorColour,
      modelYear: poLine.modelYear,
      vinNo: vin,
      motorNo: item.motorNo ? String(item.motorNo).toUpperCase() : undefined,
      mfgMonthYear: item.mfgMonthYear,
      vehicleStatus: 'IN_TRANSIT',
      status: 'IN_TRANSIT',
      pdiStatus: 'NONE',
      purchaseOrderId: po._id,
      createdBy: actorId(req.admin),
    });
    createdStocks.push(stock);
    dispatchItems.push({
      vin, model: stock.model, variant: stock.variant, colour: stock.colour,
      batteryConfig: stock.batteryConfig, mfgMonthYear: item.mfgMonthYear,
      vehicleStockId: stock._id, poLineId: poLine._id, configMatch: match,
    });
    poLine.dispatchedQty = dispatched + 1;
    await logStatusChange('VehicleStock', stock._id, null, 'IN_TRANSIT', req.admin, 'Dispatch created');
  }

  const allDispatched = po.lines.every((l) => (Number(l.dispatchedQty) || 0) >= l.qty);
  if (allDispatched && po.status === 'RELEASED') {
    po.status = 'PART_SUPPLIED';
  }
  await po.save();

  const dispatch = await Dispatch.create({
    dispatchNumber: await nextDispatchNumber(),
    purchaseOrderId: po._id,
    poNumber: po.poNumber,
    oemInvoiceNumber: req.body.oemInvoiceNumber,
    oemInvoiceDate: new Date(req.body.oemInvoiceDate),
    dispatchDate: req.body.dispatchDate ? new Date(req.body.dispatchDate) : new Date(),
    transporter: req.body.transporter,
    lrNumber: req.body.lrNumber,
    truckNumber: req.body.truckNumber,
    driverName: req.body.driverName,
    driverMobile: req.body.driverMobile,
    ewayBill: req.body.ewayBill,
    expectedArrival: req.body.expectedArrival ? new Date(req.body.expectedArrival) : undefined,
    items: dispatchItems,
    createdBy: actorId(req.admin),
  });

  for (const stock of createdStocks) {
    stock.dispatchId = dispatch._id;
    await stock.save();
  }

  return successResponse(res, { dispatch, stock: createdStocks }, 'Dispatch created', 201);
});

/* ─── Gate Entry ──────────────────────────────────────────────────── */

exports.listGateEntries = asyncHandler(async (req, res) => {
  const docs = await GateEntry.find()
    .sort({ arrivalDatetime: -1 })
    .limit(Number(req.query.limit) || 50)
    .populate('dispatchId', 'dispatchNumber truckNumber status')
    .lean();
  return successResponse(res, docs);
});

exports.createGateEntry = asyncHandler(async (req, res) => {
  const dispatch = await Dispatch.findById(req.body.dispatchId);
  if (!dispatch) throw new ApiError(404, 'Dispatch not found');
  if (dispatch.status === 'CLOSED') throw new ApiError(400, 'Dispatch already closed');

  let arrivalPhotoUrl;
  let arrivalPhotoPublicId;
  const photoFile = req.files?.arrivalPhoto?.[0];
  if (photoFile) {
    const photos = await uploadPhotos([photoFile], 'gate');
    arrivalPhotoUrl = photos[0]?.url;
    arrivalPhotoPublicId = photos[0]?.publicId;
  } else if (!req.body.arrivalPhotoUrl) {
    throw new ApiError(400, 'Arrival photo is mandatory');
  } else {
    arrivalPhotoUrl = req.body.arrivalPhotoUrl;
  }

  if (req.body.truckNumber && dispatch.truckNumber !== req.body.truckNumber) {
    throw new ApiError(400, 'Truck number does not match dispatch');
  }

  const gate = await GateEntry.create({
    gateEntryNo: await nextGateEntryNumber(),
    dispatchId: dispatch._id,
    arrivalDatetime: req.body.arrivalDatetime ? new Date(req.body.arrivalDatetime) : new Date(),
    truckNumber: req.body.truckNumber || dispatch.truckNumber,
    sealNumber: req.body.sealNumber,
    sealCondition: req.body.sealCondition || 'OK',
    sealRemark: req.body.sealRemark,
    arrivalPhotoUrl,
    arrivalPhotoPublicId,
    createdBy: actorId(req.admin),
  });

  dispatch.status = 'ARRIVED';
  await dispatch.save();

  for (const item of dispatch.items) {
    if (item.vehicleStockId) {
      const stock = await VehicleStock.findById(item.vehicleStockId);
      if (stock) {
        const from = stock.vehicleStatus;
        stock.vehicleStatus = 'ARRIVED';
        stock.status = mapVehicleStatusToLegacy('ARRIVED');
        await stock.save();
        await logStatusChange('VehicleStock', stock._id, from, 'ARRIVED', req.admin, 'Gate entry');
      }
    }
  }

  return successResponse(res, gate, 'Gate entry recorded', 201);
});

/* ─── GRN ─────────────────────────────────────────────────────────── */

exports.listGrns = asyncHandler(async (req, res) => {
  const docs = await Grn.find().sort({ grnDatetime: -1 }).limit(Number(req.query.limit) || 50).lean();
  return successResponse(res, docs);
});

exports.createGrn = asyncHandler(async (req, res) => {
  const gate = await GateEntry.findById(req.body.gateEntryId);
  if (!gate) throw new ApiError(404, 'Gate entry not found');
  const dispatch = await Dispatch.findById(gate.dispatchId);
  if (!dispatch) throw new ApiError(404, 'Dispatch not found');
  const po = await PurchaseOrder.findById(dispatch.purchaseOrderId);
  if (!po) throw new ApiError(404, 'PO not found');

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw new ApiError(400, 'Provide GRN items');

  const grnItems = [];
  let hasException = false;

  for (const item of items) {
    const vin = String(item.vin || '').trim().toUpperCase();
    const stock = await VehicleStock.findOne({ vinNo: vin });
    if (!stock) throw new ApiError(404, `VIN ${vin} not found`);

    const dispatchItem = dispatch.items.find((d) => d.vin === vin);
    const poLine = po.lines.find((l) => l.model === stock.model);
    const match = compareConfig(
      { model: poLine?.model, variant: poLine?.variant, colour: poLine?.colour, batteryConfig: poLine?.batteryConfig },
      { model: item.physicalModel || stock.model, variant: item.physicalVariant || stock.variant, colour: item.physicalColour || stock.colour },
    );

    if (match === 'MISMATCH') hasException = true;

    let photos = item.photos || [];
    const vehiclePhotos = req.files?.vehiclePhotos || [];
    const dashPhotos = req.files?.dashboardPhotos || [];
    if (vehiclePhotos.length || dashPhotos.length) {
      photos = [...photos, ...(await uploadPhotos([...vehiclePhotos, ...dashPhotos], 'grn'))];
    }

    grnItems.push({
      vin, vehicleStockId: stock._id,
      physicalModel: item.physicalModel || stock.model,
      physicalVariant: item.physicalVariant || stock.variant,
      physicalColour: item.physicalColour || stock.colour,
      matchResult: match,
      odometerKm: item.odometerKm,
      exteriorCondition: item.exteriorCondition,
      photos,
      exceptionType: match === 'MISMATCH' ? (item.exceptionType || 'Wrong Model') : item.exceptionType,
      exceptionStatus: match === 'MISMATCH' ? 'OPEN' : item.exceptionStatus,
      exceptionRemark: item.exceptionRemark,
    });

    const from = stock.vehicleStatus;
    stock.odometerKm = item.odometerKm ?? stock.odometerKm;
    stock.grnId = undefined;
    if (match === 'MISMATCH' || item.exceptionType) {
      stock.vehicleStatus = 'EXCEPTION';
      hasException = true;
    } else {
      stock.vehicleStatus = 'RECEIVED';
      stock.grnDate = stock.grnDate || new Date();
    }
    stock.status = mapVehicleStatusToLegacy(stock.vehicleStatus);
    await stock.save();
    await logStatusChange('VehicleStock', stock._id, from, stock.vehicleStatus, req.admin, 'GRN');
  }

  const grn = await Grn.create({
    grnNumber: await nextGrnNumber(),
    grnDatetime: req.body.grnDatetime ? new Date(req.body.grnDatetime) : new Date(),
    gateEntryId: gate._id,
    dispatchId: dispatch._id,
    purchaseOrderId: po._id,
    poNumber: po.poNumber,
    invoiceNumber: req.body.invoiceNumber || dispatch.oemInvoiceNumber,
    expectedQty: dispatch.items.length,
    receivedQty: items.length,
    status: hasException ? 'EXCEPTION' : 'RECEIVED',
    items: grnItems,
    createdBy: actorId(req.admin),
  });

  for (const gi of grnItems) {
    await VehicleStock.findByIdAndUpdate(gi.vehicleStockId, { grnId: grn._id });
  }

  gate.status = 'GRN_IN_PROGRESS';
  await gate.save();

  return successResponse(res, grn, hasException ? 'GRN recorded with exceptions' : 'GRN recorded', 201);
});

/* ─── Receipt Verification ────────────────────────────────────────── */

exports.listReceipts = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.status) q.receiptStatus = req.query.status;
  const docs = await ReceiptVerification.find(q).sort({ createdAt: -1 }).limit(100).lean();
  return successResponse(res, docs);
});

exports.listReceiptQueue = asyncHandler(async (_req, res) => {
  const stocks = await VehicleStock.find({
    vehicleStatus: { $in: ['RECEIVED', 'EXCEPTION'] },
    grnId: { $exists: true },
  }).select('stockId vinNo model variant colour vehicleStatus grnId').lean();
  const verified = await ReceiptVerification.find({ vehicleStockId: { $in: stocks.map((s) => s._id) } }).select('vehicleStockId').lean();
  const done = new Set(verified.map((v) => String(v.vehicleStockId)));
  const queue = stocks.filter((s) => !done.has(String(s._id)));
  return successResponse(res, queue);
});

exports.createReceipt = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.body.vehicleStockId);
  if (!stock) throw new ApiError(404, 'Vehicle not found');
  if (!['RECEIVED', 'EXCEPTION'].includes(stock.vehicleStatus)) {
    throw new ApiError(400, 'Vehicle must be RECEIVED or EXCEPTION for receipt verification');
  }

  const receiptStatus = String(req.body.receiptStatus || 'ACCEPTED').toUpperCase();
  const existing = await ReceiptVerification.findOne({ vehicleStockId: stock._id });
  if (existing) throw new ApiError(409, 'Receipt already verified for this VIN');

  const doc = await ReceiptVerification.create({
    receiptNo: await nextReceiptNumber(),
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    grnId: stock.grnId,
    documents: req.body.documents || [],
    accessories: req.body.accessories || [],
    receiptStatus,
    remarks: req.body.remarks,
    verifiedBy: actorId(req.admin),
  });

  const from = stock.vehicleStatus;
  if (receiptStatus === 'HOLD' || receiptStatus === 'REJECTED') {
    stock.vehicleStatus = 'HOLD';
    stock.holdStatus = true;
    stock.holdReason = receiptStatus === 'REJECTED' ? 'DOCUMENTATION' : 'DOCUMENTATION';
  } else {
    stock.vehicleStatus = 'RECEIPT_ACCEPTED';
    await VehicleStock.findByIdAndUpdate(stock._id, {});
    stock.vehicleStatus = 'PDI_PENDING';
    stock.pdiStatus = 'YARD_PENDING';
  }
  stock.status = mapVehicleStatusToLegacy(stock.vehicleStatus);
  await stock.save();
  await logStatusChange('VehicleStock', stock._id, from, stock.vehicleStatus, req.admin, `Receipt: ${receiptStatus}`);

  const missingAccessory = (req.body.accessories || []).some((a) => a.value === 'Missing');
  if (missingAccessory) {
    await Rectification.create({
      rectificationNo: await nextRectificationNumber(),
      vehicleStockId: stock._id,
      vin: stock.vinNo,
      source: 'Receipt',
      issueCategory: 'Accessory',
      severity: 'MAJOR',
      issueDescription: 'Missing accessory at receipt',
      status: 'OPEN',
      createdBy: actorId(req.admin),
    });
  }

  return successResponse(res, doc, 'Receipt verification saved', 201);
});

/* ─── Pre-Stock PDI ───────────────────────────────────────────────── */

exports.listPdiQueue = asyncHandler(async (_req, res) => {
  const docs = await VehicleStock.find({
    vehicleStatus: { $in: ['PDI_PENDING', 'RECEIPT_ACCEPTED'] },
    holdStatus: { $ne: true },
  }).select('stockId vinNo model variant colour vehicleStatus grnDate odometerKm').sort({ grnDate: 1 }).lean();
  return successResponse(res, docs);
});

exports.listPdis = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.type) q.type = req.query.type;
  if (req.query.vehicleStockId) q.vehicleStockId = req.query.vehicleStockId;
  const docs = await StockPdi.find(q).sort({ performedAt: -1 }).limit(100).lean();
  return successResponse(res, docs);
});

exports.createPreStockPdi = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.params.id || req.body.vehicleStockId);
  if (!stock) throw new ApiError(404, 'Vehicle not found');
  if (stock.holdStatus) throw new ApiError(400, 'VIN is on hold — PDI blocked (AC-05)');

  const result = String(req.body.result || 'FAIL').toUpperCase();
  const dtcs = Array.isArray(req.body.dtcs) ? req.body.dtcs : [];
  const hasCriticalDtc = dtcs.some((d) => d.severity === 'CRITICAL' && !d.resolved);
  if (result === 'PASS' && hasCriticalDtc && !req.body.managerApproval) {
    throw new ApiError(400, 'Critical DTC blocks PDI PASS without manager approval (AC-10)');
  }

  const pdi = await StockPdi.create({
    pdiNumber: await nextPdiNumber(),
    type: 'PRE_STOCK',
    result,
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    pdiDatetime: req.body.pdiDatetime ? new Date(req.body.pdiDatetime) : new Date(),
    technicianId: req.body.technicianId || actorId(req.admin),
    odometer: req.body.odometer,
    socPercent: req.body.socPercent,
    hvBatteryStatus: req.body.hvBatteryStatus,
    batteryWarning: req.body.batteryWarning,
    diagnosticScan: req.body.diagnosticScan,
    dtcPresent: dtcs.length > 0,
    softwareVersion: req.body.softwareVersion,
    otaPending: req.body.otaPending,
    roadTestRequired: req.body.roadTestRequired,
    roadTestKm: req.body.roadTestKm,
    roadTestResult: req.body.roadTestResult,
    socBefore: req.body.socBefore,
    socAfter: req.body.socAfter,
    managerApproval: Boolean(req.body.managerApproval),
    managerApprovedBy: req.body.managerApproval ? actorId(req.admin) : undefined,
    checklist: req.body.checklist || [],
    notes: req.body.notes,
    performedBy: actorId(req.admin),
  });

  for (const d of dtcs) {
    await VehicleDiagnostic.create({
      vehicleStockId: stock._id,
      pdiId: pdi._id,
      vin: stock.vinNo,
      dtcCode: d.dtcCode,
      dtcSeverity: d.severity || 'INFO',
      description: d.description,
      recordedBy: actorId(req.admin),
    });
  }

  if (req.body.socPercent != null) {
    stock.lastSoc = req.body.socPercent;
    stock.batteryPercent = req.body.socPercent;
  }
  if (req.body.hvBatteryStatus) stock.hvBatteryStatus = req.body.hvBatteryStatus;

  const from = stock.vehicleStatus;
  const passResults = ['PASS', 'PASS_WITH_OBSERVATION'];
  if (passResults.includes(result) || (result === 'PASS_WITH_OBSERVATION' && req.body.managerApproval)) {
    stock.vehicleStatus = 'AVAILABLE';
    stock.pdiStatus = 'YARD_PASSED';
    stock.grnDate = stock.grnDate || new Date();
    stock.stockAgeDays = computeStockAgeDays(stock.grnDate);
    stock.ageingBucket = computeAgeingBucket(stock.grnDate);
    const config = await getOrCreateConfig();
    stock.nextInspectionDue = new Date(Date.now() + (config.storageInspectionDays || 30) * 86400000);
  } else {
    stock.vehicleStatus = ['TECHNICAL_HOLD', 'OEM_HOLD'].includes(result) ? 'PDI_HOLD' : 'PDI_FAIL';
    stock.pdiStatus = 'YARD_PENDING';
    await Rectification.create({
      rectificationNo: await nextRectificationNumber(),
      vehicleStockId: stock._id,
      vin: stock.vinNo,
      source: 'PDI',
      issueCategory: 'Electrical',
      severity: result === 'FAIL' ? 'MAJOR' : 'CRITICAL',
      issueDescription: req.body.notes || `PDI result: ${result}`,
      status: 'OPEN',
      rePdiRequired: true,
      createdBy: actorId(req.admin),
    });
  }
  stock.status = mapVehicleStatusToLegacy(stock.vehicleStatus);
  await stock.save();
  await logStatusChange('VehicleStock', stock._id, from, stock.vehicleStatus, req.admin, `Pre-Stock PDI: ${result}`);

  return successResponse(res, { pdi, stock }, `Pre-Stock PDI ${result}`);
});

/* ─── Rectification ───────────────────────────────────────────────── */

exports.listRectifications = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  const docs = await Rectification.find(q).sort({ createdAt: -1 }).limit(100).lean();
  return successResponse(res, docs);
});

exports.updateRectification = asyncHandler(async (req, res) => {
  const doc = await Rectification.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Rectification not found');
  const fields = ['assignedTo', 'actionTaken', 'claimReference', 'status', 'severity', 'issueDescription'];
  for (const f of fields) {
    if (req.body[f] !== undefined) doc[f] = req.body[f];
  }
  if (req.body.status === 'COMPLETED' || req.body.status === 'CLOSED') {
    doc.completionDate = new Date();
    if (doc.rePdiRequired) doc.status = 'RE_PDI_PENDING';
  }
  await doc.save();

  if (doc.status === 'RE_PDI_PENDING') {
    const stock = await VehicleStock.findById(doc.vehicleStockId);
    if (stock) {
      stock.vehicleStatus = 'PDI_PENDING';
      stock.pdiStatus = 'YARD_PENDING';
      stock.status = mapVehicleStatusToLegacy('PDI_PENDING');
      await stock.save();
    }
  }
  return successResponse(res, doc, 'Rectification updated');
});

/* ─── Holds ───────────────────────────────────────────────────────── */

exports.placeHold = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.params.id);
  if (!stock) throw new ApiError(404, 'Vehicle not found');
  stock.holdStatus = true;
  stock.holdReason = req.body.holdReason || 'MANAGEMENT';
  const from = stock.vehicleStatus;
  stock.vehicleStatus = 'HOLD';
  stock.status = mapVehicleStatusToLegacy('HOLD');
  await stock.save();
  const hold = await VehicleHold.create({
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    holdReason: stock.holdReason,
    remarks: req.body.remarks,
    placedBy: actorId(req.admin),
  });
  await logStatusChange('VehicleStock', stock._id, from, 'HOLD', req.admin, req.body.remarks);
  return successResponse(res, { stock, hold }, 'Hold placed');
});

exports.releaseHold = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.params.id);
  if (!stock) throw new ApiError(404, 'Vehicle not found');
  stock.holdStatus = false;
  stock.holdReason = undefined;
  const from = stock.vehicleStatus;
  stock.vehicleStatus = stock.pdiStatus === 'YARD_PASSED' ? 'AVAILABLE' : 'PDI_PENDING';
  stock.status = mapVehicleStatusToLegacy(stock.vehicleStatus);
  await stock.save();
  await VehicleHold.updateMany(
    { vehicleStockId: stock._id, active: true },
    { active: false, releasedBy: actorId(req.admin), releasedAt: new Date(), releaseRemarks: req.body.remarks },
  );
  await logStatusChange('VehicleStock', stock._id, from, stock.vehicleStatus, req.admin, 'Hold released');
  return successResponse(res, stock, 'Hold released');
});

/* ─── Stock ops ───────────────────────────────────────────────────── */

exports.moveStock = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.params.id);
  if (!stock) throw new ApiError(404, 'Vehicle not found');
  const fromLocation = [stock.yardName, stock.zoneName, stock.bayName].filter(Boolean).join(' / ');
  if (req.body.yardName) stock.yardName = req.body.yardName;
  if (req.body.zoneName) stock.zoneName = req.body.zoneName;
  if (req.body.bayName) stock.bayName = req.body.bayName;
  if (req.body.branchId) stock.branchId = req.body.branchId;
  stock.location = [stock.yardName, stock.zoneName, stock.bayName].filter(Boolean).join(' / ') || stock.location;
  await stock.save();
  const toLocation = stock.location;
  await recordMovement(stock, { fromLocation, toLocation, admin: req.admin, remarks: req.body.remarks });
  await logAudit({
    entityType: 'VehicleStock', entityId: stock._id, action: 'LOCATION_CHANGE',
    oldValue: fromLocation, newValue: toLocation, userId: actorId(req.admin), userName: actorName(req.admin),
  });
  return successResponse(res, stock, 'Stock location updated (AC-08)');
});

exports.logCharging = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.params.id);
  if (!stock) throw new ApiError(404, 'Vehicle not found');
  const log = await VehicleChargingLog.create({
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    socBefore: req.body.socBefore,
    socAfter: req.body.socAfter,
    notes: req.body.notes,
    loggedBy: actorId(req.admin),
  });
  if (req.body.socAfter != null) {
    stock.lastSoc = req.body.socAfter;
    stock.batteryPercent = req.body.socAfter;
    stock.lastChargedDate = new Date();
    await stock.save();
  }
  return successResponse(res, { stock, log }, 'Charging log recorded (AC-09)');
});

exports.getVehicle360 = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.params.id)
    .populate('purchaseOrderId')
    .populate('dispatchId')
    .populate('grnId')
    .populate('orderId')
    .populate('leadId', 'name mobile status leadId');
  if (!stock) throw new ApiError(404, 'Vehicle not found');

  const [pdis, rectifications, holds, movements, charging, diagnostics, documents, audit, receipt, allocations] =
    await Promise.all([
      StockPdi.find({ vehicleStockId: stock._id }).sort({ performedAt: -1 }).lean(),
      Rectification.find({ vehicleStockId: stock._id }).sort({ createdAt: -1 }).lean(),
      VehicleHold.find({ vehicleStockId: stock._id }).sort({ createdAt: -1 }).lean(),
      StockMovement.find({ vehicleStockId: stock._id }).sort({ createdAt: -1 }).limit(50).lean(),
      VehicleChargingLog.find({ vehicleStockId: stock._id }).sort({ createdAt: -1 }).lean(),
      VehicleDiagnostic.find({ vehicleStockId: stock._id }).sort({ createdAt: -1 }).lean(),
      VehicleDocument.find({ vehicleStockId: stock._id }).sort({ createdAt: -1 }).lean(),
      listAuditLogs('VehicleStock', stock._id, 50),
      ReceiptVerification.findOne({ vehicleStockId: stock._id }).lean(),
      VehicleAllocation.find({ vehicleStockId: stock._id }).sort({ createdAt: -1 }).lean(),
    ]);

  return successResponse(res, {
    stock, receipt, pdis, rectifications, holds, movements, charging, diagnostics, documents, audit, allocations,
  });
});

/* ─── Dashboard KPIs ──────────────────────────────────────────────── */

exports.getDashboard = asyncHandler(async (req, res) => {
  const config = await getOrCreateConfig();
  const branchFilter = req.query.branchId ? { branchId: req.query.branchId } : {};
  const modelFilter = req.query.model ? { model: req.query.model } : {};

  const base = { ...branchFilter, ...modelFilter };

  const [
    poReleased, inTransit, grnPending, receiptExceptions,
    pdiPending, pdiFailed, physicalStock, availableStock,
    reservedBooked, ageing60, lowSoc,
  ] = await Promise.all([
    PurchaseOrder.countDocuments({ status: { $in: ['RELEASED', 'PART_SUPPLIED'] } }),
    VehicleStock.countDocuments({ ...base, vehicleStatus: 'IN_TRANSIT' }),
    GateEntry.countDocuments({ status: 'ARRIVED' }),
    VehicleStock.countDocuments({ ...base, vehicleStatus: 'EXCEPTION' }),
    VehicleStock.countDocuments({ ...base, vehicleStatus: { $in: ['PDI_PENDING', 'RECEIPT_ACCEPTED'] } }),
    VehicleStock.countDocuments({ ...base, vehicleStatus: { $in: ['PDI_FAIL', 'PDI_HOLD'] } }),
    VehicleStock.countDocuments({ ...base, vehicleStatus: { $nin: ['DELIVERED'] } }),
    VehicleStock.countDocuments({ ...base, vehicleStatus: 'AVAILABLE', holdStatus: { $ne: true } }),
    VehicleStock.countDocuments({ ...base, vehicleStatus: { $in: ['RESERVED', 'BOOKED', 'INVOICED', 'DELIVERY_READY'] } }),
    VehicleStock.countDocuments({ ...base, ageingBucket: { $in: ['61-90', '90+'] } }),
    VehicleStock.countDocuments({ ...base, lastSoc: { $lt: config.socLowThreshold }, vehicleStatus: 'AVAILABLE' }),
  ]);

  const poValue = await PurchaseOrder.aggregate([
    { $match: { status: { $in: ['RELEASED', 'PART_SUPPLIED', 'CLOSED'] } } },
    { $unwind: '$lines' },
    { $group: { _id: null, total: { $sum: '$lines.netPurchaseValue' } } },
  ]);

  return successResponse(res, {
    procurement: { poRaised: poReleased, poValue: poValue[0]?.total || 0 },
    transit: { inTransit },
    receipt: { grnPending, receiptExceptions },
    pdi: { pdiPending, pdiFailedHold: pdiFailed },
    stock: { physicalStock, availableStock, reservedBooked, ageing60Plus: ageing60 },
    evHealth: { lowSocAlert: lowSoc },
    filters: { branchId: req.query.branchId, model: req.query.model },
  });
});

module.exports.recordMovement = recordMovement;
module.exports.assertAvailableForAllocation = assertAvailableForAllocation;
