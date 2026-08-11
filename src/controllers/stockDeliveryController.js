const Counter = require('../models/Counter');
const PurchaseOrder = require('../models/PurchaseOrder');
const StockPdi = require('../models/StockPdi');
const VehicleOrder = require('../models/VehicleOrder');
const VehicleStock = require('../models/VehicleStock');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { normalizeStageLabel } = require('../constants/leadStages');
const {
  ensureVehicleOrderForLead,
  backfillBookingVehicleOrders,
} = require('../utils/ensureVehicleOrder');

async function nextCounter(key, prefix, pad = 4) {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `${prefix}${String(doc.seq).padStart(pad, '0')}`;
}

async function nextStockId() {
  return nextCounter('vehicle_stock', 'STK', 4);
}

async function nextPoNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`po_${ymd}`, `PO-${ymd}-`, 3);
}

function actorId(admin) {
  return admin?._id || undefined;
}

async function syncLeadStage(leadId, toStage, admin, reason) {
  if (!leadId) return;
  const lead = await Lead.findById(leadId);
  if (!lead) return;
  const from = lead.status;
  if (normalizeStageLabel(from) === normalizeStageLabel(toStage)) return;
  lead.status = toStage;
  if (toStage === 'Delivered') {
    lead.convertedAt = lead.convertedAt || new Date();
    lead.creSheet = lead.creSheet || {};
    lead.creSheet.retailDone = true;
    lead.creSheet.retailDate = lead.creSheet.retailDate || new Date();
    lead.creSheet.deliveryDate = lead.creSheet.deliveryDate || new Date();
  }
  if (toStage === 'Booking') {
    lead.creSheet = lead.creSheet || {};
    lead.creSheet.bookingDone = true;
    lead.creSheet.bookingDate = lead.creSheet.bookingDate || new Date();
  }
  await lead.save();
  await LeadStageHistory.create({
    leadId: lead._id,
    fromStage: from,
    toStage,
    changedBy: actorId(admin),
    reason: reason || `Stock & Delivery: ${toStage}`,
  });
}

async function findOrderOrThrow(id) {
  const doc = await VehicleOrder.findById(id)
    .populate('leadId', 'name mobile status source model leadId')
    .populate('stockId')
    .populate('assignedExecutive', 'name email')
    .populate('createdBy', 'name email');
  if (!doc) throw new ApiError(404, 'Vehicle order not found');
  return doc;
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

exports.createPurchaseOrder = asyncHandler(async (req, res) => {
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
  if (!lines.length) throw new ApiError(400, 'Provide at least one PO line');
  const normalized = lines.map((l) => ({
    model: String(l.model || '').trim(),
    variant: String(l.variant || '').trim() || undefined,
    colour: String(l.colour || '').trim() || undefined,
    qty: Math.max(1, Number(l.qty) || 1),
    receivedQty: 0,
  }));
  if (normalized.some((l) => !l.model)) throw new ApiError(400, 'Each line needs a model');

  const doc = await PurchaseOrder.create({
    poNumber: await nextPoNumber(),
    status: 'DRAFT',
    supplier: req.body?.supplier || 'VinFast',
    expectedDate: req.body?.expectedDate ? new Date(req.body.expectedDate) : undefined,
    remarks: req.body?.remarks,
    lines: normalized,
    createdBy: actorId(req.admin),
  });
  return successResponse(res, doc, 'Purchase order created', 201);
});

exports.raisePurchaseOrder = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Purchase order not found');
  if (doc.status !== 'DRAFT') throw new ApiError(400, 'Only DRAFT POs can be raised');
  doc.status = 'RAISED';
  doc.raisedAt = new Date();
  await doc.save();
  return successResponse(res, doc, 'Purchase order raised');
});

exports.receiveTransit = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, 'Purchase order not found');
  if (!['RAISED', 'PARTIAL'].includes(po.status)) {
    throw new ApiError(400, 'PO must be RAISED or PARTIAL to receive stock');
  }

  const units = Array.isArray(req.body?.units) ? req.body.units : [];
  if (!units.length) throw new ApiError(400, 'Provide units [{ model, vinNo, ... }]');

  const created = [];
  for (const unit of units) {
    const model = String(unit.model || '').trim();
    const vinNo = String(unit.vinNo || '').trim().toUpperCase();
    if (!model || !vinNo) throw new ApiError(400, 'Each unit needs model and vinNo');
    const exists = await VehicleStock.findOne({ vinNo });
    if (exists) throw new ApiError(409, `VIN ${vinNo} already exists (${exists.stockId})`);

    const line = po.lines.find(
      (l) =>
        l.model === model &&
        (!unit.variant || l.variant === unit.variant) &&
        (!unit.colour || l.colour === unit.colour),
    ) || po.lines.find((l) => l.model === model);
    if (!line) throw new ApiError(400, `No PO line matches model ${model}`);
    if (line.receivedQty >= line.qty) {
      throw new ApiError(400, `PO line for ${model} already fully received`);
    }

    const stock = await VehicleStock.create({
      stockId: await nextStockId(),
      model,
      variant: unit.variant || line.variant,
      colour: unit.colour || line.colour,
      vinNo,
      motorNo: unit.motorNo ? String(unit.motorNo).toUpperCase() : undefined,
      motorNo2: unit.motorNo2 ? String(unit.motorNo2).toUpperCase() : undefined,
      status: 'IN_TRANSIT',
      pdiStatus: 'YARD_PENDING',
      purchaseOrderId: po._id,
      location: unit.location || 'In transit',
      createdBy: actorId(req.admin),
      remarks: unit.remarks,
    });
    line.receivedQty += 1;
    created.push(stock);
  }

  const yardPdi = req.body?.yardPdi;
  const yardResult = yardPdi?.result ? String(yardPdi.result).toUpperCase() : '';
  const pdiDocs = [];
  if (yardResult && ['PASS', 'FAIL'].includes(yardResult)) {
    for (const stock of created) {
      const pdi = await StockPdi.create({
        type: 'YARD',
        result: yardResult,
        vehicleStockId: stock._id,
        checklist: Array.isArray(yardPdi.checklist) ? yardPdi.checklist : [],
        notes: yardPdi.notes,
        performedBy: actorId(req.admin),
        performedAt: new Date(),
      });
      pdiDocs.push(pdi);
      if (yardResult === 'PASS') {
        stock.status = 'FRESH_STOCK';
        stock.pdiStatus = 'YARD_PASSED';
        stock.grnDate = stock.grnDate || new Date();
        stock.location = yardPdi.location || stock.location || 'Yard';
      } else {
        stock.pdiStatus = 'YARD_PENDING';
        stock.remarks = [stock.remarks, `Yard PDI FAIL: ${yardPdi.notes || ''}`]
          .filter(Boolean)
          .join(' | ');
      }
      await stock.save();
    }
  }

  const allDone = po.lines.every((l) => l.receivedQty >= l.qty);
  const anyReceived = po.lines.some((l) => l.receivedQty > 0);
  po.status = allDone ? 'CLOSED' : anyReceived ? 'PARTIAL' : po.status;
  if (allDone) po.closedAt = new Date();
  await po.save();

  const msg =
    yardResult === 'PASS'
      ? `Received ${created.length} unit(s) — Yard PDI PASS (free stock)`
      : yardResult === 'FAIL'
        ? `Received ${created.length} unit(s) — Yard PDI FAIL (held)`
        : `Received ${created.length} unit(s) in transit`;

  return successResponse(
    res,
    { purchaseOrder: po, stock: created, pdi: pdiDocs },
    msg,
  );
});

/* ─── Yard / Final PDI ────────────────────────────────────────────── */

exports.yardPdi = asyncHandler(async (req, res) => {
  const stock = await VehicleStock.findById(req.params.id);
  if (!stock) throw new ApiError(404, 'Stock unit not found');
  if (stock.status !== 'IN_TRANSIT' && stock.pdiStatus !== 'YARD_PENDING') {
    throw new ApiError(400, 'Yard PDI is only for in-transit / yard-pending units');
  }

  const result = String(req.body?.result || '').toUpperCase();
  if (!['PASS', 'FAIL'].includes(result)) throw new ApiError(400, 'result must be PASS or FAIL');

  const pdi = await StockPdi.create({
    type: 'YARD',
    result,
    vehicleStockId: stock._id,
    checklist: Array.isArray(req.body?.checklist) ? req.body.checklist : [],
    notes: req.body?.notes,
    performedBy: actorId(req.admin),
    performedAt: new Date(),
  });

  if (result === 'PASS') {
    stock.status = 'FRESH_STOCK';
    stock.pdiStatus = 'YARD_PASSED';
    stock.grnDate = stock.grnDate || new Date();
    stock.location = req.body?.location || stock.location || 'Yard';
  } else {
    stock.pdiStatus = 'YARD_PENDING';
    stock.remarks = [stock.remarks, `Yard PDI FAIL: ${req.body?.notes || ''}`].filter(Boolean).join(' | ');
  }
  await stock.save();
  return successResponse(res, { stock, pdi }, `Yard PDI ${result}`);
});

exports.finalPdi = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!order.stockId) throw new ApiError(400, 'Allocate a vehicle before Final PDI');
  if (!['REGISTRATION', 'FINAL_PDI', 'ALLOCATED', 'PAYMENT', 'INSURANCE'].includes(order.stage)) {
    // Allow FINAL_PDI from registration onward; also allow if earlier milestones marked
  }

  const result = String(req.body?.result || '').toUpperCase();
  if (!['PASS', 'FAIL'].includes(result)) throw new ApiError(400, 'result must be PASS or FAIL');

  const stock = await VehicleStock.findById(order.stockId._id || order.stockId);
  if (!stock) throw new ApiError(404, 'Allocated stock not found');

  const pdi = await StockPdi.create({
    type: 'FINAL',
    result,
    vehicleStockId: stock._id,
    orderId: order._id,
    checklist: Array.isArray(req.body?.checklist) ? req.body.checklist : [],
    notes: req.body?.notes,
    performedBy: actorId(req.admin),
    performedAt: new Date(),
  });

  if (result === 'PASS') {
    stock.pdiStatus = 'FINAL_PASSED';
    order.finalPdiPassed = true;
    order.stage = 'FINAL_PDI';
  } else {
    stock.pdiStatus = 'FINAL_PENDING';
    order.finalPdiPassed = false;
    order.stage = 'FINAL_PDI';
  }
  await stock.save();
  await order.save();
  return successResponse(res, { order, stock, pdi }, `Final PDI ${result}`);
});

/* ─── Vehicle Orders ──────────────────────────────────────────────── */

exports.listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};
  if (req.query.stage) query.stage = String(req.query.stage).toUpperCase();
  if (req.query.leadId) query.leadId = req.query.leadId;
  const [docs, total] = await Promise.all([
    VehicleOrder.find(query)
      .populate('leadId', 'name mobile status source model leadId')
      .populate('stockId', 'stockId vinNo model status motorNo')
      .populate('assignedExecutive', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    VehicleOrder.countDocuments(query),
  ]);
  return successResponse(res, docs, undefined, 200, { page, limit, total });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const doc = await findOrderOrThrow(req.params.id);
  return successResponse(res, doc);
});

exports.createOrder = asyncHandler(async (req, res) => {
  const leadId = req.body?.leadId;
  if (!leadId) throw new ApiError(400, 'leadId is required');
  const lead = await Lead.findById(leadId);
  if (!lead) throw new ApiError(404, 'Lead not found');

  let result;
  try {
    result = await ensureVehicleOrderForLead(lead, req.admin, {
      preferredModel: req.body?.preferredModel,
      preferredVariant: req.body?.preferredVariant,
      preferredColour: req.body?.preferredColour,
      remarks: req.body?.remarks,
      syncLead: true,
      reason: 'Vehicle order opened from CRM',
    });
  } catch (e) {
    throw new ApiError(400, e.message || 'Could not create vehicle order');
  }

  const populated = await findOrderOrThrow(result.order._id);
  return successResponse(
    res,
    populated,
    result.created ? 'Vehicle order created' : 'Open vehicle order already exists',
    result.created ? 201 : 200,
  );
});

/** One-shot: create missing VehicleOrders for Booking leads. Managers only. */
exports.backfillBookingOrders = asyncHandler(async (req, res) => {
  const designation = String(req.admin.designation || '').toLowerCase();
  const canRun =
    ['manager', 'superadmin'].includes(req.admin.role) ||
    req.admin.userType === 'admin' ||
    ['sales_manager', 'sales_head', 'gm', 'ceo', 'md'].includes(designation);
  if (!canRun) throw new ApiError(403, 'Only managers and admins can run backfill');

  const summary = await backfillBookingVehicleOrders(req.admin);
  return successResponse(res, summary, `Backfill done — created ${summary.created}`);
});

exports.availability = asyncHandler(async (req, res) => {
  const model = String(req.query.model || '').trim();
  if (!model) throw new ApiError(400, 'model is required');
  const query = { model, status: 'FRESH_STOCK', isDemo: { $ne: true } };
  if (req.query.variant) query.variant = String(req.query.variant).trim();
  if (req.query.colour) query.colour = String(req.query.colour).trim();
  const units = await VehicleStock.find(query)
    .select('stockId vinNo model variant colour motorNo motorNo2 location status pdiStatus')
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();
  return successResponse(res, { count: units.length, units });
});

exports.allocateOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (order.stockId) throw new ApiError(400, 'Order already has an allocated vehicle');
  if (['DELIVERED', 'CANCELLED', 'RETAIL'].includes(order.stage)) {
    throw new ApiError(400, `Cannot allocate in stage ${order.stage}`);
  }

  let stock;
  if (req.body?.stockId) {
    stock = await VehicleStock.findById(req.body.stockId);
  } else {
    const q = {
      model: order.preferredModel,
      status: 'FRESH_STOCK',
      isDemo: { $ne: true },
    };
    if (order.preferredVariant) q.variant = order.preferredVariant;
    if (order.preferredColour) q.colour = order.preferredColour;
    stock = await VehicleStock.findOne(q).sort({ createdAt: 1 });
  }
  if (!stock) {
    if (order.stage !== 'AWAITING_STOCK') {
      order.stage = 'AWAITING_STOCK';
      await order.save();
    }
    throw new ApiError(404, 'No free stock available for this model — raise a PO');
  }
  if (stock.status !== 'FRESH_STOCK' || stock.isDemo) {
    throw new ApiError(400, 'Selected unit is not free stock');
  }

  stock.status = 'RESERVED';
  stock.orderId = order._id;
  stock.leadId = order.leadId?._id || order.leadId;
  await stock.save();

  order.stockId = stock._id;
  order.vinNo = stock.vinNo;
  order.motorNo = stock.motorNo;
  order.motorNo2 = stock.motorNo2;
  order.stage = 'ALLOCATED';
  await order.save();

  await syncLeadStage(order.leadId?._id || order.leadId, 'Booking', req.admin, 'VIN allocated');
  return successResponse(res, await findOrderOrThrow(order._id), `Allocated ${stock.vinNo}`);
});

exports.releaseOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!order.stockId) throw new ApiError(400, 'No stock allocated');
  if (['RETAIL', 'DELIVERED'].includes(order.stage)) {
    throw new ApiError(400, 'Cannot release after retail/delivery');
  }

  const stock = await VehicleStock.findById(order.stockId._id || order.stockId);
  if (stock && stock.status === 'RESERVED') {
    stock.status = 'FRESH_STOCK';
    stock.orderId = undefined;
    stock.leadId = undefined;
    await stock.save();
  }

  order.stockId = undefined;
  order.vinNo = undefined;
  order.motorNo = undefined;
  order.motorNo2 = undefined;
  order.stage = 'AWAITING_STOCK';
  order.finalPdiPassed = false;
  await order.save();
  return successResponse(res, await findOrderOrThrow(order._id), 'Allocation released');
});

function applyMilestone(target, body) {
  if (!target) return;
  if (body.done != null) target.done = Boolean(body.done);
  if (body.done) target.doneAt = body.doneAt ? new Date(body.doneAt) : new Date();
  if (body.notes != null) target.notes = body.notes;
  if (body.docUrl != null) target.docUrl = body.docUrl;
}

exports.updatePayment = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!order.stockId) throw new ApiError(400, 'Allocate a vehicle first');
  applyMilestone(order.payment, req.body || {});
  if (req.body?.downPayment != null) order.payment.downPayment = String(req.body.downPayment);
  if (req.body?.finance != null) order.payment.finance = String(req.body.finance);
  if (req.body?.paymentMode != null) order.payment.paymentMode = String(req.body.paymentMode);
  if (order.payment.done) order.stage = 'PAYMENT';
  await order.save();
  return successResponse(res, await findOrderOrThrow(order._id), 'Payment updated');
});

exports.updateInsurance = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!order.payment?.done) throw new ApiError(400, 'Complete payment milestone first');
  applyMilestone(order.insurance, req.body || {});
  if (order.insurance.done) order.stage = 'INSURANCE';
  await order.save();
  return successResponse(res, await findOrderOrThrow(order._id), 'Insurance updated');
});

exports.updateRegistration = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!order.insurance?.done) throw new ApiError(400, 'Complete insurance milestone first');
  applyMilestone(order.registration, req.body || {});
  if (order.registration.done) {
    order.stage = 'REGISTRATION';
    const stock = await VehicleStock.findById(order.stockId?._id || order.stockId);
    if (stock && req.body?.registrationNo) {
      stock.registrationNo = String(req.body.registrationNo).toUpperCase();
      stock.pdiStatus = stock.pdiStatus === 'FINAL_PASSED' ? stock.pdiStatus : 'FINAL_PENDING';
      await stock.save();
    }
  }
  await order.save();
  return successResponse(res, await findOrderOrThrow(order._id), 'Registration updated');
});

exports.retailSale = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!order.stockId) throw new ApiError(400, 'Allocate a vehicle first');
  if (!order.finalPdiPassed) throw new ApiError(400, 'Final PDI must PASS before retail sale');

  const stock = await VehicleStock.findById(order.stockId._id || order.stockId);
  if (!stock) throw new ApiError(404, 'Allocated stock not found');

  stock.status = 'SOLD';
  stock.billingDate = stock.billingDate || new Date();
  await stock.save();

  order.stage = 'RETAIL';
  order.retailSaleAt = new Date();
  await order.save();

  await syncLeadStage(order.leadId?._id || order.leadId, 'Delivered', req.admin, 'Retail sale recorded');
  return successResponse(res, await findOrderOrThrow(order._id), 'Retail sale recorded');
});

exports.deliverOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (order.stage !== 'RETAIL' && order.stage !== 'DELIVERED') {
    throw new ApiError(400, 'Complete retail sale before delivery handover');
  }

  order.stage = 'DELIVERED';
  order.deliveredAt = new Date();
  const origin = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || '';
  order.feedbackUrl =
    req.body?.feedbackUrl ||
    (origin ? `${origin.replace(/\/$/, '')}/feedback/post-delivery` : '/feedback/post-delivery');
  await order.save();

  const leadId = order.leadId?._id || order.leadId;
  if (leadId) {
    const lead = await Lead.findById(leadId);
    if (lead) {
      lead.creSheet = lead.creSheet || {};
      lead.creSheet.deliveryDate = order.deliveredAt;
      await lead.save();
    }
  }

  return successResponse(res, await findOrderOrThrow(order._id), 'Vehicle delivered');
});

exports.listDeliveries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = { stage: { $in: ['RETAIL', 'DELIVERED'] } };
  const [docs, total] = await Promise.all([
    VehicleOrder.find(query)
      .populate('leadId', 'name mobile status source model leadId')
      .populate('stockId', 'stockId vinNo model colour motorNo registrationNo')
      .sort({ deliveredAt: -1, retailSaleAt: -1 })
      .skip(skip)
      .limit(limit),
    VehicleOrder.countDocuments(query),
  ]);
  return successResponse(res, docs, undefined, 200, { page, limit, total });
});
