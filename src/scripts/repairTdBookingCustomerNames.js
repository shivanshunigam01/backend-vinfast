/**
 * Backfill real customer names on TD bookings from linked CRM leads.
 *
 * Usage:
 *   REPAIR_TD_NAMES_CONFIRM=yes node src/scripts/repairTdBookingCustomerNames.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const TDCustomer = require('../models/TDCustomer');
const { upsertTDCustomer } = require('../utils/tdCustomerResolver');

(async () => {
  if (process.env.REPAIR_TD_NAMES_CONFIRM !== 'yes') {
    console.error('Set REPAIR_TD_NAMES_CONFIRM=yes to run this repair.');
    process.exit(1);
  }

  await connectDB();

  const bookings = await TDBooking.find({}).sort({ createdAt: 1 });
  let repaired = 0;
  let skipped = 0;
  let noLead = 0;

  for (const booking of bookings) {
    let lead = null;
    if (booking.leadId) {
      lead = await Lead.findById(booking.leadId)
        .select('name mobile email city model')
        .lean();
    }
    if (!lead && booking.customerMobile) {
      lead = await Lead.findOne({ mobile: String(booking.customerMobile).trim() })
        .select('name mobile email city model')
        .lean();
    }

    if (!lead?.name || !lead?.mobile) {
      noLead += 1;
      skipped += 1;
      continue;
    }

    const customer = await upsertTDCustomer({
      name: lead.name,
      mobile: lead.mobile,
      email: lead.email,
      city: lead.city,
    });

    booking.customerId = customer._id;
    booking.customerName = lead.name;
    booking.customerMobile = lead.mobile;
    booking.customerEmail = lead.email || booking.customerEmail;
    booking.customerCity = lead.city || booking.customerCity;
    if (lead.model && !booking.preferredModel) {
      booking.preferredModel = lead.model;
    }
    if (!booking.leadId) {
      const leadDoc = await Lead.findOne({ mobile: lead.mobile, model: lead.model || booking.preferredModel })
        .select('_id')
        .lean();
      if (leadDoc) booking.leadId = leadDoc._id;
    }
    await booking.save();
    repaired += 1;
  }

  const orphanPlaceholders = await TDCustomer.find({ mobile: /^TD-/ }).select('_id').lean();
  let orphansDeleted = 0;
  for (const c of orphanPlaceholders) {
    const stillUsed = await TDBooking.exists({ customerId: c._id });
    if (!stillUsed) {
      await TDCustomer.deleteOne({ _id: c._id });
      orphansDeleted += 1;
    }
  }

  const fallbackLeft = await TDBooking.countDocuments({
    $or: [
      { customerName: { $in: [null, '', 'Customer'] } },
      { customerName: { $exists: false } },
    ],
  });

  console.log('\n=== TD customer name repair ===');
  console.log({
    totalBookings: bookings.length,
    repaired,
    skipped,
    noLead,
    orphanPlaceholderCustomersDeleted: orphansDeleted,
    bookingsStillMissingName: fallbackLeft,
  });

  process.exit(0);
})().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
