const TDCustomer = require('../models/TDCustomer');

function pickStr(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

/** Extract customer fields from a booking document (mongoose doc or raw mongo). */
function extractCustomerFromBooking(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const customerRef = raw.customerId;
  if (customerRef && typeof customerRef === 'object' && !customerRef._bsontype) {
    const name = pickStr(customerRef.name, customerRef.customerName);
    const mobile = pickStr(customerRef.mobile, customerRef.phone);
    if (name || mobile) {
      return {
        name: name || 'Customer',
        mobile: mobile || '0000000000',
        email: pickStr(customerRef.email) || undefined,
        city: pickStr(customerRef.city) || undefined,
        customerId: pickStr(customerRef.customerId) || undefined,
      };
    }
  }

  const embedded = raw.customer;
  if (embedded && typeof embedded === 'object') {
    const name = pickStr(embedded.name, embedded.customerName);
    const mobile = pickStr(embedded.mobile, embedded.phone);
    if (name || mobile) {
      return {
        name: name || 'Customer',
        mobile: mobile || '0000000000',
        email: pickStr(embedded.email) || undefined,
        city: pickStr(embedded.city) || undefined,
        customerId: pickStr(embedded.customerId) || undefined,
      };
    }
  }

  const testDrive = raw.testDriveId;
  if (testDrive && typeof testDrive === 'object' && !testDrive._bsontype) {
    const name = pickStr(testDrive.customerName, testDrive.name);
    const mobile = pickStr(testDrive.mobile, testDrive.phone);
    if (name || mobile) {
      return {
        name: name || 'Customer',
        mobile: mobile || '0000000000',
        email: pickStr(testDrive.email) || undefined,
        city: pickStr(testDrive.city) || undefined,
      };
    }
  }

  const name = pickStr(raw.customerName, raw.name);
  const mobile = pickStr(raw.customerMobile, raw.mobile, raw.phone);
  if (name || mobile) {
    return {
      name: name || 'Customer',
      mobile: mobile || '0000000000',
      email: pickStr(raw.customerEmail, raw.email) || undefined,
      city: pickStr(raw.customerCity, raw.city) || undefined,
      customerId: pickStr(raw.customerCode) || undefined,
    };
  }

  return null;
}

async function upsertTDCustomer(patch) {
  const mobile = pickStr(patch.mobile);
  const name = pickStr(patch.name) || 'Customer';
  let doc = mobile ? await TDCustomer.findOne({ mobile }) : null;
  if (!doc) {
    doc = await TDCustomer.create({
      name,
      mobile: mobile || `TD-${Date.now()}`,
      email: patch.email,
      city: patch.city,
      customerId: patch.customerId || `TDC-${Date.now().toString(36).toUpperCase()}`,
    });
    return doc;
  }
  let changed = false;
  if (name && doc.name !== name) {
    doc.name = name;
    changed = true;
  }
  if (patch.email && !doc.email) {
    doc.email = patch.email;
    changed = true;
  }
  if (patch.city && !doc.city) {
    doc.city = patch.city;
    changed = true;
  }
  if (changed) await doc.save();
  return doc;
}

/**
 * Ensure booking has a linked TDCustomer; backfill from legacy embedded fields when needed.
 */
async function ensureBookingCustomer(doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  const populated = plain.customerId;
  if (populated && typeof populated === 'object' && populated.name) {
    return doc;
  }

  let source = extractCustomerFromBooking(plain);
  if (!source) {
    const raw = await doc.constructor.collection.findOne({ _id: doc._id });
    source = extractCustomerFromBooking(raw);
  }
  if (!source) return doc;

  const customer = await upsertTDCustomer(source);
  doc.customerId = customer._id;
  await doc.save();
  await doc.populate({ path: 'customerId' });
  return doc;
}

async function ensureBookingsCustomers(docs) {
  const out = [];
  for (const doc of docs) {
    out.push(await ensureBookingCustomer(doc));
  }
  return out;
}

module.exports = {
  extractCustomerFromBooking,
  upsertTDCustomer,
  ensureBookingCustomer,
  ensureBookingsCustomers,
};
