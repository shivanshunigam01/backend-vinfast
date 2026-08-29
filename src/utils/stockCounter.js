const Counter = require('../models/Counter');

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

async function nextDispatchNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`dispatch_${ymd}`, `DSP-${ymd}-`, 3);
}

async function nextGateEntryNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`gate_${ymd}`, `GE-${ymd}-`, 3);
}

async function nextGrnNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`grn_${ymd}`, `GRN-${ymd}-`, 3);
}

async function nextReceiptNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`receipt_${ymd}`, `RCV-${ymd}-`, 3);
}

async function nextPdiNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`pdi_${ymd}`, `PDI-${ymd}-`, 3);
}

async function nextRectificationNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`rect_${ymd}`, `RCT-${ymd}-`, 3);
}

async function nextOrderNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return nextCounter(`vo_${ymd}`, `VO-${ymd}-`, 3);
}

module.exports = {
  nextCounter,
  nextStockId,
  nextPoNumber,
  nextDispatchNumber,
  nextGateEntryNumber,
  nextGrnNumber,
  nextReceiptNumber,
  nextPdiNumber,
  nextRectificationNumber,
  nextOrderNumber,
};
