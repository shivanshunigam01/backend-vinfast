/**
 * Seed connected dummy data across the full stock pipeline for end-to-end testing.
 *
 * Usage:
 *   npm run seed:stock-pipeline-demo
 *   SEED_DEMO_RESET=yes npm run seed:stock-pipeline-demo   # wipe prior demo rows first
 *
 * Creates PO → Dispatch → Gate → GRN → Receipt → Pre-Stock PDI → Allocation →
 * Final PDI → Retail → Delivery Ready → DELIVERED with shared VIN / FK links.
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');

const PurchaseOrder = require('../models/PurchaseOrder');
const Dispatch = require('../models/Dispatch');
const GateEntry = require('../models/GateEntry');
const Grn = require('../models/Grn');
const ReceiptVerification = require('../models/ReceiptVerification');
const StockPdi = require('../models/StockPdi');
const VehicleStock = require('../models/VehicleStock');
const VehicleOrder = require('../models/VehicleOrder');
const VehicleAllocation = require('../models/VehicleAllocation');
const VehicleModel = require('../models/VehicleModel');
const Lead = require('../models/Lead');
const StockMovement = require('../models/StockMovement');
const Rectification = require('../models/Rectification');
const VehicleHold = require('../models/VehicleHold');
const VehicleDiagnostic = require('../models/VehicleDiagnostic');
const VehicleDocument = require('../models/VehicleDocument');
const VehicleChargingLog = require('../models/VehicleChargingLog');
const AuditLog = require('../models/AuditLog');

const { ensureStockConfigReady } = require('../utils/stockBootstrap');
const {
  nextPoNumber, nextDispatchNumber, nextGateEntryNumber, nextGrnNumber,
  nextReceiptNumber, nextPdiNumber, nextStockId, nextOrderNumber,
} = require('../utils/stockCounter');
const { nextLeadId } = require('../utils/pvIdGenerator');
const {
  mapVehicleStatusToLegacy, computeAgeingBucket, computeStockAgeDays, compareConfig,
} = require('../services/vehicleLifecycleService');

const DEMO_PO_PREFIX = 'DEMO-PO-';
const DEMO_VIN_PREFIX = 'DEMOVF7';
const DEMO_PHOTO = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
const RESET = process.env.SEED_DEMO_RESET !== 'no';

const CATALOG = [
  {
    name: 'VF 7',
    variants: ['Sky Infinity', 'Sky', 'Wind Infinity', 'Wind', 'Earth'],
  },
  {
    name: 'VF 6',
    variants: ['Wind Infinity', 'Wind', 'Earth'],
  },
  {
    name: 'VF MPV 7',
    variants: [],
  },
  {
    name: 'Limo Green',
    variants: [],
  },
];

function poLine({ model, variant, colour, qty = 1, basicPrice = 2189000 }) {
  const gst = Math.round(basicPrice * 0.05);
  return {
    model,
    variant,
    colour,
    interiorColour: variant === 'Earth' ? 'Beige' : 'Mocha Brown',
    modelYear: 2026,
    qty,
    receivedQty: 0,
    basicPrice,
    gstAmount: gst,
    freight: 15000,
    discount: 0,
    netPurchaseValue: basicPrice + gst + 15000,
  };
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

async function ensureCatalog() {
  for (let i = 0; i < CATALOG.length; i += 1) {
    const row = CATALOG[i];
    await VehicleModel.findOneAndUpdate(
      { name: row.name },
      {
        name: row.name,
        active: true,
        displayOrder: i,
        variants: row.variants.map((name, displayOrder) => ({ name, active: true, displayOrder })),
      },
      { upsert: true, new: true },
    );
  }
}

async function cleanupDemoData() {
  const stocks = await VehicleStock.find({ vinNo: new RegExp(`^${DEMO_VIN_PREFIX}`) }).lean();
  const stockIds = stocks.map((s) => s._id);
  const orderIds = stocks.map((s) => s.orderId).filter(Boolean);
  const vins = stocks.map((s) => s.vinNo);

  if (!stockIds.length) {
    await PurchaseOrder.deleteMany({ poNumber: new RegExp(`^${DEMO_PO_PREFIX}`) });
    await Lead.deleteMany({ mobile: /^99000DEMO/ });
    return;
  }

  const grnIds = stocks.map((s) => s.grnId).filter(Boolean);
  const dispatchIds = stocks.map((s) => s.dispatchId).filter(Boolean);
  const poIds = stocks.map((s) => s.purchaseOrderId).filter(Boolean);

  await VehicleAllocation.deleteMany({ $or: [{ vehicleStockId: { $in: stockIds } }, { vin: { $in: vins } }] });
  await StockPdi.deleteMany({ vehicleStockId: { $in: stockIds } });
  await ReceiptVerification.deleteMany({ vehicleStockId: { $in: stockIds } });
  await Rectification.deleteMany({ vehicleStockId: { $in: stockIds } });
  await VehicleHold.deleteMany({ vehicleStockId: { $in: stockIds } });
  await StockMovement.deleteMany({ vehicleStockId: { $in: stockIds } });
  await VehicleDiagnostic.deleteMany({ vehicleStockId: { $in: stockIds } });
  await VehicleDocument.deleteMany({ vehicleStockId: { $in: stockIds } });
  await VehicleChargingLog.deleteMany({ vehicleStockId: { $in: stockIds } });
  await AuditLog.deleteMany({ entityId: { $in: stockIds.map(String) } });

  await Grn.deleteMany({ _id: { $in: grnIds } });
  await GateEntry.deleteMany({ dispatchId: { $in: dispatchIds } });
  await Dispatch.deleteMany({ _id: { $in: dispatchIds } });
  await VehicleOrder.deleteMany({ _id: { $in: orderIds } });
  await VehicleStock.deleteMany({ _id: { $in: stockIds } });
  await PurchaseOrder.deleteMany({ _id: { $in: poIds } });
  await PurchaseOrder.deleteMany({ poNumber: new RegExp(`^${DEMO_PO_PREFIX}`) });
  await Lead.deleteMany({ mobile: /^99000DEMO/ });
}

async function createDemoLead({ name, mobileSuffix, model, variant, colour }) {
  const mobile = `99000DEMO${mobileSuffix}`;
  let lead = await Lead.findOne({ mobile });
  if (lead) return lead;
  lead = await Lead.create({
    leadId: await nextLeadId(),
    name,
    mobile,
    city: 'Patna',
    model: variant ? `${model} ${variant}` : model,
    source: 'Walk-in',
    status: 'Booking',
    creSheet: { bookingDone: true, bookingDate: daysAgo(5) },
    remarks: 'Demo lead for stock pipeline seed',
  });
  return lead;
}

async function createPo({ poNumber, status, line, approvalSteps = [] }) {
  const doc = await PurchaseOrder.create({
    poNumber,
    status,
    locked: ['RELEASED', 'PART_SUPPLIED', 'CLOSED'].includes(status),
    supplier: 'VinFast',
    poType: 'Regular',
    paymentTerms: 'Advance',
    deliveryLocation: 'Patliputra VinFast — Patna',
    lines: [poLine(line)],
    approvalHistory: approvalSteps,
    releasedAt: status === 'RELEASED' ? daysAgo(8) : undefined,
    raisedAt: ['RELEASED', 'PART_SUPPLIED'].includes(status) ? daysAgo(10) : undefined,
    remarks: 'Demo PO — safe to use for pipeline testing',
  });
  return doc;
}

async function createDispatchForPo(po, item, truckNo) {
  const match = compareConfig(
    { model: po.lines[0].model, variant: po.lines[0].variant, colour: po.lines[0].colour },
    { model: item.model, variant: item.variant, colour: item.colour },
  );

  const stock = await VehicleStock.create({
    stockId: await nextStockId(),
    model: item.model,
    variant: item.variant,
    colour: item.colour,
    interiorColour: po.lines[0].interiorColour,
    modelYear: po.lines[0].modelYear,
    vinNo: item.vin,
    motorNo: item.motorNo,
    motorNo2: item.motorNo2,
    mfgMonthYear: '01/2026',
    vehicleStatus: 'IN_TRANSIT',
    status: mapVehicleStatusToLegacy('IN_TRANSIT'),
    pdiStatus: 'NONE',
    purchaseOrderId: po._id,
    location: 'In transit',
    remarks: 'Demo pipeline vehicle',
  });

  const dispatch = await Dispatch.create({
    dispatchNumber: await nextDispatchNumber(),
    purchaseOrderId: po._id,
    poNumber: po.poNumber,
    oemInvoiceNumber: `OEM-${item.vin.slice(-6)}`,
    oemInvoiceDate: daysAgo(7),
    dispatchDate: daysAgo(7),
    transporter: 'VinFast Logistics',
    lrNumber: `LR${item.vin.slice(-6)}`,
    truckNumber: truckNo,
    driverName: 'Demo Driver',
    driverMobile: '9876500000',
    expectedArrival: daysAgo(5),
    status: 'IN_TRANSIT',
    items: [{
      vin: item.vin,
      model: stock.model,
      variant: stock.variant,
      colour: stock.colour,
      vehicleStockId: stock._id,
      configMatch: match,
    }],
  });

  stock.dispatchId = dispatch._id;
  await stock.save();
  return { dispatch, stock };
}

async function recordGate(dispatch, stock) {
  const gate = await GateEntry.create({
    gateEntryNo: await nextGateEntryNumber(),
    dispatchId: dispatch._id,
    arrivalDatetime: daysAgo(6),
    truckNumber: dispatch.truckNumber,
    sealNumber: 'SEAL-DEMO',
    sealCondition: 'OK',
    arrivalPhotoUrl: DEMO_PHOTO,
  });
  dispatch.status = 'ARRIVED';
  await dispatch.save();
  stock.vehicleStatus = 'ARRIVED';
  stock.status = mapVehicleStatusToLegacy('ARRIVED');
  await stock.save();
  return gate;
}

async function recordGrn({ gate, dispatch, po, stock, exception = false }) {
  const match = exception ? 'MISMATCH' : 'MATCH';
  const grn = await Grn.create({
    grnNumber: await nextGrnNumber(),
    grnDatetime: daysAgo(5),
    gateEntryId: gate._id,
    dispatchId: dispatch._id,
    purchaseOrderId: po._id,
    poNumber: po.poNumber,
    invoiceNumber: dispatch.oemInvoiceNumber,
    expectedQty: 1,
    receivedQty: 1,
    status: exception ? 'EXCEPTION' : 'RECEIVED',
    items: [{
      vin: stock.vinNo,
      vehicleStockId: stock._id,
      physicalModel: stock.model,
      physicalVariant: stock.variant,
      physicalColour: stock.colour,
      matchResult: match,
      odometerKm: 12,
      exteriorCondition: 'Good',
      exceptionType: exception ? 'Config mismatch (demo)' : undefined,
      exceptionStatus: exception ? 'OPEN' : undefined,
    }],
  });

  stock.odometerKm = 12;
  stock.vehicleStatus = exception ? 'EXCEPTION' : 'RECEIVED';
  stock.grnDate = exception ? undefined : daysAgo(5);
  stock.grnId = grn._id;
  stock.status = mapVehicleStatusToLegacy(stock.vehicleStatus);
  await stock.save();

  gate.status = 'GRN_IN_PROGRESS';
  await gate.save();
  return grn;
}

async function recordReceipt(stock) {
  const receipt = await ReceiptVerification.create({
    receiptNo: await nextReceiptNumber(),
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    grnId: stock.grnId,
    receiptStatus: 'ACCEPTED',
    documents: [
      { key: 'invoice', label: 'Tax Invoice', value: 'Received' },
      { key: 'rc', label: 'RC / Temp RC', value: 'Pending' },
    ],
    accessories: [
      { key: 'charger', label: 'Portable charger', value: 'OK' },
      { key: 'mats', label: 'Floor mats', value: 'OK' },
    ],
    remarks: 'Demo receipt verification',
  });
  stock.vehicleStatus = 'PDI_PENDING';
  stock.pdiStatus = 'YARD_PENDING';
  stock.status = mapVehicleStatusToLegacy('PDI_PENDING');
  await stock.save();
  return receipt;
}

async function recordPreStockPdi(stock) {
  const pdi = await StockPdi.create({
    pdiNumber: await nextPdiNumber(),
    type: 'PRE_STOCK',
    result: 'PASS',
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    pdiDatetime: daysAgo(3),
    odometer: stock.odometerKm,
    socPercent: 82,
    hvBatteryStatus: 'OK',
    diagnosticScan: true,
    checklist: [{ key: 'exterior', label: 'Exterior', value: 'OK' }],
    notes: 'Demo pre-stock PDI PASS',
  });
  stock.vehicleStatus = 'AVAILABLE';
  stock.pdiStatus = 'YARD_PASSED';
  stock.grnDate = stock.grnDate || daysAgo(5);
  stock.stockAgeDays = computeStockAgeDays(stock.grnDate);
  stock.ageingBucket = computeAgeingBucket(stock.grnDate);
  stock.location = 'Patna Yard — Bay A';
  stock.status = mapVehicleStatusToLegacy('AVAILABLE');
  await stock.save();
  return pdi;
}

async function createOrderForStock(stock, lead, stage) {
  const order = await VehicleOrder.create({
    orderNumber: await nextOrderNumber(),
    stage,
    leadId: lead._id,
    stockId: ['ALLOCATED', 'PAYMENT', 'INSURANCE', 'REGISTRATION', 'FINAL_PDI', 'INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(stage) ? stock._id : undefined,
    customerName: lead.name,
    customerMobile: lead.mobile,
    preferredModel: stock.model,
    preferredVariant: stock.variant,
    preferredColour: stock.colour,
    bookingNo: `BK-DEMO-${stock.vinNo.slice(-4)}`,
    vinNo: stock.vinNo,
    motorNo: stock.motorNo,
    motorNo2: stock.motorNo2,
    reservationExpiry: daysAgo(-3),
    payment: { done: ['PAYMENT', 'INSURANCE', 'REGISTRATION', 'FINAL_PDI', 'INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(stage), doneAt: daysAgo(2), paymentMode: 'Finance' },
    insurance: { done: ['INSURANCE', 'REGISTRATION', 'FINAL_PDI', 'INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(stage), doneAt: daysAgo(2) },
    registration: {
      done: ['REGISTRATION', 'FINAL_PDI', 'INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(stage),
      doneAt: daysAgo(1),
      notes: 'BR01DE1234',
    },
    finalPdiPassed: ['INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(stage),
    retailSaleAt: ['INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(stage) ? daysAgo(1) : undefined,
    invoicedAt: ['INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(stage) ? daysAgo(1) : undefined,
    deliveryReadyAt: ['DELIVERY_READY', 'DELIVERED'].includes(stage) ? daysAgo(0) : undefined,
    deliveredAt: stage === 'DELIVERED' ? new Date() : undefined,
    remarks: 'Demo vehicle order — linked to pipeline seed',
  });
  return order;
}

async function allocateStock(stock, order, lead) {
  stock.vehicleStatus = 'RESERVED';
  stock.status = mapVehicleStatusToLegacy('RESERVED');
  stock.orderId = order._id;
  stock.leadId = lead._id;
  stock.reservationExpiry = daysAgo(-3);
  await stock.save();

  await VehicleAllocation.create({
    vehicleStockId: stock._id,
    orderId: order._id,
    leadId: lead._id,
    vin: stock.vinNo,
    customerName: lead.name,
    bookingNo: order.bookingNo,
    status: order.stage === 'INVOICED' || order.stage === 'DELIVERY_READY' || order.stage === 'DELIVERED' ? 'BOOKED' : 'ACTIVE',
    reservationExpiry: stock.reservationExpiry,
  });

  order.stockId = stock._id;
  order.vinNo = stock.vinNo;
  order.stage = 'ALLOCATED';
  await order.save();
}

async function advanceRetail(stock, order) {
  await StockPdi.create({
    pdiNumber: await nextPdiNumber(),
    type: 'FINAL',
    result: 'PASS',
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    orderId: order._id,
    notes: 'Demo final PDI PASS',
  });
  stock.pdiStatus = 'FINAL_PASSED';
  stock.vehicleStatus = 'INVOICED';
  stock.status = mapVehicleStatusToLegacy('INVOICED');
  stock.billingDate = daysAgo(1);
  stock.registrationNo = 'BR01DE1234';
  await stock.save();
  order.stage = 'INVOICED';
  order.finalPdiPassed = true;
  await order.save();
}

async function advanceDeliveryReady(stock, order) {
  stock.vehicleStatus = 'DELIVERY_READY';
  stock.status = mapVehicleStatusToLegacy('DELIVERY_READY');
  await stock.save();
  order.stage = 'DELIVERY_READY';
  order.deliveryReadyAt = new Date();
  await order.save();
}

async function advanceDelivered(stock, order, lead) {
  stock.vehicleStatus = 'DELIVERED';
  stock.status = mapVehicleStatusToLegacy('DELIVERED');
  await stock.save();
  order.stage = 'DELIVERED';
  order.deliveredAt = new Date();
  await order.save();
  lead.status = 'Delivered';
  lead.creSheet = lead.creSheet || {};
  lead.creSheet.deliveryDate = order.deliveredAt;
  lead.creSheet.retailDone = true;
  await lead.save();
  await StockMovement.create({
    vehicleStockId: stock._id,
    vin: stock.vinNo,
    fromStatus: 'DELIVERY_READY',
    toStatus: 'DELIVERED',
    remarks: 'Demo delivery handover',
  });
}

/**
 * Build one fully linked vehicle at the requested lifecycle stage.
 */
async function seedVehicleScenario({
  index,
  label,
  targetStage,
  line,
  exception = false,
  withOrder = false,
  orderStage,
}) {
  const vin = `${DEMO_VIN_PREFIX}${String(index).padStart(5, '0')}`;
  const poNumber = `${DEMO_PO_PREFIX}${String(index).padStart(3, '0')}`;
  const truckNo = `BR01D${String(index).padStart(4, '0')}`;

  const po = await createPo({
    poNumber,
    status: 'RELEASED',
    line,
    approvalSteps: [
      { action: 'SUBMIT', status: 'SUBMITTED', byName: 'Demo Seeder', at: daysAgo(12) },
      { action: 'APPROVE', status: 'APPROVED', byName: 'Demo Seeder', at: daysAgo(11) },
      { action: 'RELEASE', status: 'RELEASED', byName: 'Demo Seeder', at: daysAgo(10) },
    ],
  });

  const item = {
    vin,
    model: line.model,
    variant: line.variant,
    colour: line.colour,
    motorNo: `MTR${String(index).padStart(6, '0')}`,
    motorNo2: line.variant === 'Sky Infinity' || line.variant === 'Sky' ? `MTR2${String(index).padStart(5, '0')}` : undefined,
  };

  let { dispatch, stock } = await createDispatchForPo(po, item, truckNo);
  let gate;
  let grn;
  let receipt;
  let pdi;
  let order;
  let lead;

  if (targetStage === 'IN_TRANSIT') {
    return { label, po, dispatch, stock, vin, stage: targetStage };
  }

  gate = await recordGate(dispatch, stock);
  if (targetStage === 'ARRIVED') {
    return { label, po, dispatch, gate, stock, vin, stage: targetStage };
  }

  grn = await recordGrn({ gate, dispatch, po, stock, exception });
  if (targetStage === 'RECEIVED' || targetStage === 'EXCEPTION') {
    return { label, po, dispatch, gate, grn, stock, vin, stage: stock.vehicleStatus };
  }

  receipt = await recordReceipt(stock);
  if (targetStage === 'PDI_PENDING') {
    return { label, po, dispatch, gate, grn, receipt, stock, vin, stage: targetStage };
  }

  pdi = await recordPreStockPdi(stock);
  if (targetStage === 'AVAILABLE') {
    return { label, po, dispatch, gate, grn, receipt, pdi, stock, vin, stage: targetStage };
  }

  if (withOrder || orderStage) {
    lead = await createDemoLead({
      name: `Demo Customer ${index}`,
      mobileSuffix: String(index).padStart(2, '0'),
      model: line.model,
      variant: line.variant,
      colour: line.colour,
    });
    order = await createOrderForStock(stock, lead, orderStage || 'AWAITING_STOCK');
  }

  if (['RESERVED', 'ALLOCATED', 'INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(targetStage)) {
    await allocateStock(stock, order, lead);
    stock = await VehicleStock.findById(stock._id);
    order = await VehicleOrder.findById(order._id);
  }

  if (targetStage === 'RESERVED' || targetStage === 'ALLOCATED') {
    return { label, po, dispatch, gate, grn, receipt, pdi, order, lead, stock, vin, stage: 'RESERVED' };
  }

  if (['INVOICED', 'DELIVERY_READY', 'DELIVERED'].includes(targetStage)) {
    order.stage = 'REGISTRATION';
    await order.save();
    await advanceRetail(stock, order);
    stock = await VehicleStock.findById(stock._id);
    order = await VehicleOrder.findById(order._id);
  }

  if (targetStage === 'INVOICED') {
    return { label, po, order, lead, stock, vin, stage: 'INVOICED' };
  }

  if (targetStage === 'DELIVERY_READY') {
    await advanceDeliveryReady(stock, order);
    stock = await VehicleStock.findById(stock._id);
    return { label, po, order, lead, stock, vin, stage: 'DELIVERY_READY' };
  }

  if (targetStage === 'DELIVERED') {
    await advanceDeliveryReady(stock, order);
    await advanceDelivered(stock, order, lead);
    stock = await VehicleStock.findById(stock._id);
    return { label, po, order, lead, stock, vin, stage: 'DELIVERED' };
  }

  return { label, po, stock, vin, stage: targetStage };
}

async function seedPoOnlyScenarios() {
  const rows = [];
  rows.push(await createPo({
    poNumber: `${DEMO_PO_PREFIX}DRAFT`,
    status: 'DRAFT',
    line: { model: 'VF 7', variant: 'Earth', colour: 'Urban Mint' },
  }));
  rows.push(await createPo({
    poNumber: `${DEMO_PO_PREFIX}SUBMIT`,
    status: 'SUBMITTED',
    line: { model: 'VF 6', variant: 'Wind', colour: 'Crimson Red' },
    approvalSteps: [{ action: 'SUBMIT', status: 'SUBMITTED', byName: 'Demo Seeder', at: daysAgo(2) }],
  }));
  rows.push(await createPo({
    poNumber: `${DEMO_PO_PREFIX}APPROVE`,
    status: 'APPROVED',
    line: { model: 'VF 7', variant: 'Wind Infinity', colour: 'Zenith Grey' },
    approvalSteps: [
      { action: 'SUBMIT', status: 'SUBMITTED', byName: 'Demo Seeder', at: daysAgo(4) },
      { action: 'APPROVE', status: 'APPROVED', byName: 'Demo Seeder', at: daysAgo(3) },
    ],
  }));
  rows.push(await createPo({
    poNumber: `${DEMO_PO_PREFIX}RELEASE`,
    status: 'RELEASED',
    line: { model: 'VF 7', variant: 'Sky', colour: 'Jet Black', qty: 2 },
    approvalSteps: [
      { action: 'SUBMIT', status: 'SUBMITTED', byName: 'Demo Seeder', at: daysAgo(6) },
      { action: 'APPROVE', status: 'APPROVED', byName: 'Demo Seeder', at: daysAgo(5) },
      { action: 'RELEASE', status: 'RELEASED', byName: 'Demo Seeder', at: daysAgo(4) },
    ],
  }));
  return rows;
}

async function main() {
  await connectDB();
  await ensureStockConfigReady();
  await ensureCatalog();

  if (RESET) {
    console.log('Removing previous demo pipeline data…');
    await cleanupDemoData();
  }

  console.log('Seeding PO-only stages (Draft / Submit / Approve / Released)…');
  await seedPoOnlyScenarios();

  const vehiclePlans = [
    { index: 1, label: 'Dispatch queue', targetStage: 'IN_TRANSIT', line: { model: 'VF 7', variant: 'Sky Infinity', colour: 'Infinity Blanc' } },
    { index: 2, label: 'Gate → GRN queue (Arrived)', targetStage: 'ARRIVED', line: { model: 'VF 7', variant: 'Earth', colour: 'Urban Mint' } },
    { index: 3, label: 'Receipt queue (Received)', targetStage: 'RECEIVED', line: { model: 'VF 7', variant: 'Wind', colour: 'Desat Silver' } },
    { index: 4, label: 'GRN exception', targetStage: 'RECEIVED', line: { model: 'VF 7', variant: 'Sky', colour: 'Jet Black' }, exception: true },
    { index: 5, label: 'Pre-Stock PDI queue', targetStage: 'PDI_PENDING', line: { model: 'VF 7', variant: 'Wind Infinity', colour: 'Zenith Grey' } },
    { index: 6, label: 'Available stock', targetStage: 'AVAILABLE', line: { model: 'VF 7', variant: 'Sky Infinity', colour: 'Infinity Blanc' } },
    { index: 7, label: 'Allocated / Reserved', targetStage: 'RESERVED', line: { model: 'VF 7', variant: 'Earth', colour: 'Infinity Blanc' }, withOrder: true },
    { index: 8, label: 'Retail / Invoiced', targetStage: 'INVOICED', line: { model: 'VF 7', variant: 'Wind', colour: 'Desat Silver' }, withOrder: true },
    { index: 9, label: 'Delivery ready', targetStage: 'DELIVERY_READY', line: { model: 'VF 6', variant: 'Earth', colour: 'Urban Mint' }, withOrder: true },
    { index: 10, label: 'Delivered (full flow)', targetStage: 'DELIVERED', line: { model: 'VF 7', variant: 'Sky Infinity', colour: 'Crimson Red' }, withOrder: true },
  ];

  console.log('Seeding connected vehicles across pipeline stages…');
  const results = [];
  for (const plan of vehiclePlans) {
    // eslint-disable-next-line no-await-in-loop
    const row = await seedVehicleScenario(plan);
    results.push(row);
    console.log(`  ✓ ${plan.label}: VIN ${row.vin} → ${row.stage}`);
  }

  console.log('\n── Demo pipeline summary ──');
  console.log('PO tabs: look for DEMO-PO-DRAFT, DEMO-PO-SUBMIT, DEMO-PO-APPROVE, DEMO-PO-RELEASE');
  console.log('VIN prefix: DEMOVF7* — each links PO → Dispatch → Gate → GRN → Receipt → PDI → Order');
  console.log('\nStage guide (admin sidebar):');
  console.log('  1 PO          — DEMO-PO-DRAFT / SUBMIT / APPROVE / RELEASE + DEMO-PO-001…');
  console.log('  2 Dispatch    — DEMOVF700001 (IN_TRANSIT — create Gate Entry here)');
  console.log('  3 Gate        — DEMOVF700002 (ARRIVED — create GRN here)');
  console.log('  4 GRN         — DEMOVF700003 received, 00004 exception');
  console.log('  5 Receipt     — DEMOVF700003 (RECEIVED — verify receipt here)');
  console.log('  6 Pre-Stock   — DEMOVF700005 (PDI_PENDING)');
  console.log('  7 Stock       — DEMOVF700006 (AVAILABLE)');
  console.log('  8 Allocation  — DEMOVF700007 (RESERVED + demo order)');
  console.log('  9 Final PDI   — use allocated order or advance manually');
  console.log(' 10 Retail      — DEMOVF700008 (INVOICED)');
  console.log(' 11 Delivery    — DEMOVF700009 ready, 000010 DELIVERED');
  console.log('\nRun: npm run seed:stock-pipeline-demo');
  console.log('Skip wipe: SEED_DEMO_RESET=no npm run seed:stock-pipeline-demo');
  console.log(`\nSeeded ${results.length} connected vehicles + 4 PO workflow rows.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
