const Counter = require('../models/Counter');
const PurchaseOrder = require('../models/PurchaseOrder');
const StockPdi = require('../models/StockPdi');
const VehicleOrder = require('../models/VehicleOrder');
const VehicleStock = require('../models/VehicleStock');
const VehicleAllocation = require('../models/VehicleAllocation');
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
const { nextOrderNumber } = require('../utils/stockCounter');
const { getOrCreateConfig } = require('./stockConfigController');
const {
  assertAvailableForAllocation,
  mapVehicleStatusToLegacy,
  computeAgeingBucket,
  computeStockAgeDays,
} = require('../services/vehicleLifecycleService');
const { logStatusChange } = require('../services/auditService');
const { recordMovement } = require('./stockPipelineController');

async function notifyLeadCrmEvent(leadId, admin, { type, title, priority }) {
  if (!leadId) return;
  try {
    const { notifyLeadAssignees, leadHref, displayLeadName } = require('../utils/staffNotifications');
    const lead = await Lead.findById(leadId);
    if (!lead) return;
    await notifyLeadAssignees(lead, {
      actorId: admin?._id,
      type,
      title,
      body: displayLeadName(lead),
      customerName: displayLeadName(lead),
      href: leadHref(lead._id),
      priority,
    });
  } catch (err) {
    console.error('[notifyLeadCrmEvent]', err.message);
  }
}

async function nextVoNumber() {
  return nextOrderNumber();
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

/* ─── Yard / Final PDI (legacy — use pipeline pre-stock PDI) ─────── */

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
  const query = {
    model,
    vehicleStatus: 'AVAILABLE',
    holdStatus: { $ne: true },
    isDemo: { $ne: true },
  };
  if (req.query.variant) query.variant = String(req.query.variant).trim();
  if (req.query.colour) query.colour = String(req.query.colour).trim();
  const units = await VehicleStock.find(query)
    .select('stockId vinNo model variant colour motorNo motorNo2 location status vehicleStatus pdiStatus grnDate ageingBucket')
    .sort({ grnDate: 1, createdAt: 1 })
    .limit(100)
    .lean();
  return successResponse(res, { count: units.length, units });
});

exports.allocateOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (order.stockId) throw new ApiError(400, 'Order already has an allocated vehicle');
  if (['DELIVERED', 'CANCELLED', 'INVOICED', 'DELIVERY_READY'].includes(order.stage)) {
    throw new ApiError(400, `Cannot allocate in stage ${order.stage}`);
  }

  let stock;
  if (req.body?.stockId) {
    stock = await VehicleStock.findById(req.body.stockId);
  } else {
    const q = {
      model: order.preferredModel,
      vehicleStatus: 'AVAILABLE',
      holdStatus: { $ne: true },
      isDemo: { $ne: true },
    };
    if (order.preferredVariant) q.variant = order.preferredVariant;
    if (order.preferredColour) q.colour = order.preferredColour;
    stock = await VehicleStock.findOne(q).sort({ grnDate: 1, createdAt: 1 });
  }
  if (!stock) {
    if (order.stage !== 'AWAITING_STOCK') {
      order.stage = 'AWAITING_STOCK';
      await order.save();
    }
    throw new ApiError(404, 'No free stock available for this model — raise a PO');
  }
  assertAvailableForAllocation(stock);

  const config = await getOrCreateConfig();
  const expiryHours = config.reservationExpiryHours || 72;
  const reservationExpiry = new Date(Date.now() + expiryHours * 3600000);

  const from = stock.vehicleStatus;
  stock.vehicleStatus = 'RESERVED';
  stock.status = mapVehicleStatusToLegacy('RESERVED');
  stock.orderId = order._id;
  stock.leadId = order.leadId?._id || order.leadId;
  stock.reservationExpiry = reservationExpiry;
  await stock.save();
  await logStatusChange('VehicleStock', stock._id, from, 'RESERVED', req.admin, 'Allocated to order');

  await VehicleAllocation.create({
    vehicleStockId: stock._id,
    orderId: order._id,
    leadId: order.leadId?._id || order.leadId,
    vin: stock.vinNo,
    customerName: order.customerName,
    bookingNo: order.bookingNo,
    status: 'ACTIVE',
    reservationExpiry,
    allocatedBy: actorId(req.admin),
  });

  order.stockId = stock._id;
  order.vinNo = stock.vinNo;
  order.motorNo = stock.motorNo;
  order.motorNo2 = stock.motorNo2;
  order.reservationExpiry = reservationExpiry;
  order.stage = 'ALLOCATED';
  await order.save();

  await syncLeadStage(order.leadId?._id || order.leadId, 'Booking', req.admin, 'VIN allocated');
  return successResponse(res, await findOrderOrThrow(order._id), `Allocated ${stock.vinNo}`);
});

exports.releaseOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!order.stockId) throw new ApiError(400, 'No stock allocated');
  if (['INVOICED', 'DELIVERY_READY', 'DELIVERED', 'RETAIL'].includes(order.stage)) {
    throw new ApiError(400, 'Cannot release after invoicing/delivery');
  }

  const stock = await VehicleStock.findById(order.stockId._id || order.stockId);
  if (stock && ['RESERVED', 'BOOKED'].includes(stock.vehicleStatus)) {
    const from = stock.vehicleStatus;
    stock.vehicleStatus = 'AVAILABLE';
    stock.status = mapVehicleStatusToLegacy('AVAILABLE');
    stock.orderId = undefined;
    stock.leadId = undefined;
    stock.reservationExpiry = undefined;
    await stock.save();
    await logStatusChange('VehicleStock', stock._id, from, 'AVAILABLE', req.admin, 'Allocation released');
  }

  await VehicleAllocation.updateMany(
    { orderId: order._id, status: 'ACTIVE' },
    { status: 'RELEASED', releasedAt: new Date() },
  );

  order.stockId = undefined;
  order.vinNo = undefined;
  order.motorNo = undefined;
  order.motorNo2 = undefined;
  order.reservationExpiry = undefined;
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
  if (stock.holdStatus) throw new ApiError(400, 'VIN is on hold — cannot invoice (AC-05)');

  const from = stock.vehicleStatus;
  stock.vehicleStatus = 'INVOICED';
  stock.status = mapVehicleStatusToLegacy('INVOICED');
  stock.billingDate = stock.billingDate || new Date();
  await stock.save();
  await logStatusChange('VehicleStock', stock._id, from, 'INVOICED', req.admin, 'Retail invoice');

  order.stage = 'INVOICED';
  order.retailSaleAt = new Date();
  order.invoicedAt = new Date();
  await order.save();

  await VehicleAllocation.updateMany({ orderId: order._id, status: 'ACTIVE' }, { status: 'BOOKED' });

  await syncLeadStage(order.leadId?._id || order.leadId, 'Booking', req.admin, 'Retail sale recorded');
  await notifyLeadCrmEvent(order.leadId?._id || order.leadId, req.admin, {
    type: 'booking',
    title: 'Retail / booking completed',
    priority: 'done',
  });
  return successResponse(res, await findOrderOrThrow(order._id), 'Retail sale recorded');
});

exports.markDeliveryReady = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (order.stage !== 'INVOICED' && order.stage !== 'RETAIL') {
    throw new ApiError(400, 'Order must be invoiced before delivery ready');
  }
  const stock = await VehicleStock.findById(order.stockId?._id || order.stockId);
  if (stock) {
    const from = stock.vehicleStatus;
    stock.vehicleStatus = 'DELIVERY_READY';
    stock.status = mapVehicleStatusToLegacy('DELIVERY_READY');
    await stock.save();
    await logStatusChange('VehicleStock', stock._id, from, 'DELIVERY_READY', req.admin, 'Delivery ready');
  }
  order.stage = 'DELIVERY_READY';
  order.deliveryReadyAt = new Date();
  await order.save();
  return successResponse(res, await findOrderOrThrow(order._id), 'Marked delivery ready');
});

exports.deliverOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOrThrow(req.params.id);
  if (!['DELIVERY_READY', 'INVOICED', 'RETAIL'].includes(order.stage)) {
    throw new ApiError(400, 'Complete delivery ready / retail before handover');
  }

  order.stage = 'DELIVERED';
  order.deliveredAt = new Date();
  const origin = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || '';
  order.feedbackUrl =
    req.body?.feedbackUrl ||
    (origin ? `${origin.replace(/\/$/, '')}/feedback/post-delivery` : '/feedback/post-delivery');
  await order.save();

  const stock = await VehicleStock.findById(order.stockId?._id || order.stockId);
  if (stock) {
    const from = stock.vehicleStatus;
    stock.vehicleStatus = 'DELIVERED';
    stock.status = mapVehicleStatusToLegacy('DELIVERED');
    await stock.save();
    await recordMovement(stock, { fromStatus: from, toStatus: 'DELIVERED', admin: req.admin, remarks: 'Delivered' });
    await logStatusChange('VehicleStock', stock._id, from, 'DELIVERED', req.admin, 'Handover complete');
  }

  const leadId = order.leadId?._id || order.leadId;
  if (leadId) {
    const lead = await Lead.findById(leadId);
    if (lead) {
      lead.status = 'Delivered';
      lead.creSheet = lead.creSheet || {};
      lead.creSheet.deliveryDate = order.deliveredAt;
      lead.creSheet.retailDone = true;
      await lead.save();
    }
    await syncLeadStage(leadId, 'Delivered', req.admin, 'Vehicle delivered');
  }

  await notifyLeadCrmEvent(leadId, req.admin, {
    type: 'delivery',
    title: 'Vehicle delivered',
    priority: 'done',
  });

  return successResponse(res, await findOrderOrThrow(order._id), 'Vehicle delivered');
});

exports.listDeliveries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = { stage: { $in: ['INVOICED', 'DELIVERY_READY', 'RETAIL', 'DELIVERED'] } };
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
