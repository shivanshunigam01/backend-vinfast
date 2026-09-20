/**
 * Find TD bookings showing "Customer" and trace linked lead names / sources.
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const TDBooking = require('../models/TDBooking');
const TDCustomer = require('../models/TDCustomer');
const Lead = require('../models/Lead');

function isFallbackName(name) {
  const s = String(name || '').trim();
  return !s || s === 'Customer';
}

(async () => {
  await connectDB();

  const bookings = await TDBooking.find({})
    .select('bookingId customerName customerMobile leadId customerId createdAt preferredModel')
    .lean();

  const fallbackBookings = [];
  for (const b of bookings) {
    let displayName = b.customerName;
    if (b.customerId) {
      const c = await TDCustomer.findById(b.customerId).select('name mobile').lean();
      if (c) displayName = c.name;
    }
    if (isFallbackName(displayName)) {
      fallbackBookings.push({ ...b, tdCustomerName: displayName });
    }
  }

  console.log('Total TD bookings:', bookings.length);
  console.log('Showing "Customer" or blank name:', fallbackBookings.length);

  const bySource = {};
  const samples = [];

  for (const b of fallbackBookings) {
    let lead = null;
    if (b.leadId) {
      lead = await Lead.findById(b.leadId)
        .select('name mobile source model creSheet.enquiryDate createdAt')
        .lean();
    }
    const source = lead?.source || (b.leadId ? 'lead-no-source' : 'no-lead-link');
    bySource[source] = (bySource[source] || 0) + 1;

    if (samples.length < 15) {
      samples.push({
        bookingId: b.bookingId,
        customerMobile: b.customerMobile,
        bookingCustomerName: b.customerName,
        leadName: lead?.name || null,
        leadMobile: lead?.mobile || null,
        leadSource: lead?.source || null,
        leadModel: lead?.model || null,
        enquiryDate: lead?.creSheet?.enquiryDate || null,
      });
    }
  }

  console.log('\nBy lead source (for fallback-name bookings):');
  console.table(
    Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count })),
  );

  console.log('\nSample rows (booking vs linked lead name):');
  console.table(samples);

  const tdCustomerOnly = await TDCustomer.countDocuments({ name: 'Customer' });
  const placeholderMobile = await TDCustomer.countDocuments({ mobile: /^TD-/ });
  const realNames = await TDCustomer.countDocuments({ name: { $ne: 'Customer' } });
  console.log('\nTDCustomer name exactly "Customer":', tdCustomerOnly);
  console.log('TDCustomer placeholder mobile (TD-*):', placeholderMobile);
  console.log('TDCustomer with real names:', realNames);

  console.log('\nFirst 5 bookings (import order):');
  const early = await TDBooking.find({}).sort({ createdAt: 1 }).limit(5).lean();
  for (const b of early) {
    const c = b.customerId ? await TDCustomer.findById(b.customerId).lean() : null;
    const l = b.leadId ? await Lead.findById(b.leadId).select('name mobile source').lean() : null;
    console.log({
      bookingId: b.bookingId,
      bookingCustomerName: b.customerName,
      tdCustomer: c ? { name: c.name, mobile: c.mobile } : null,
      lead: l ? { name: l.name, mobile: l.mobile, source: l.source } : null,
    });
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
