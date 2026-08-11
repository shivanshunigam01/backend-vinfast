/**
 * Ensure an open VehicleOrder exists for a lead (Booking Done → Vehicle Orders).
 * Idempotent: returns existing open order if present.
 */
const VehicleOrder = require('../models/VehicleOrder');
const VehicleStock = require('../models/VehicleStock');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const Counter = require('../models/Counter');
const { normalizeStageLabel } = require('../constants/leadStages');

async function nextOrderNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const doc = await Counter.findOneAndUpdate(
    { key: `vo_${ymd}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `VO-${ymd}-${String(doc.seq).padStart(3, '0')}`;
}

function actorId(admin) {
  return admin?._id || undefined;
}

/**
 * Mark lead Booking + bookingDone without duplicating history when already Booking.
 */
async function markLeadBookingDone(lead, admin, reason) {
  if (!lead) return;
  const from = lead.status;
  const alreadyBooking = normalizeStageLabel(from) === 'Booking';
  lead.creSheet = lead.creSheet || {};
  lead.creSheet.bookingDone = true;
  lead.creSheet.bookingDate = lead.creSheet.bookingDate || new Date();
  if (!alreadyBooking) {
    lead.status = 'Booking';
  }
  await lead.save();
  if (!alreadyBooking) {
    await LeadStageHistory.create({
      leadId: lead._id,
      fromStage: from,
      toStage: 'Booking',
      changedBy: actorId(admin),
      reason: reason || 'Booking done — vehicle order ensured',
    });
  }
}

/**
 * @param {object} lead — Lead document (or lean with _id)
 * @param {object|null} admin
 * @param {object} [opts]
 * @param {string} [opts.preferredModel]
 * @param {string} [opts.preferredVariant]
 * @param {string} [opts.preferredColour]
 * @param {string} [opts.remarks]
 * @param {boolean} [opts.syncLead=true] — set Booking + bookingDone
 * @returns {{ order: object, created: boolean }}
 */
async function ensureVehicleOrderForLead(lead, admin, opts = {}) {
  const leadDoc = lead?._id ? lead : await Lead.findById(lead);
  if (!leadDoc?._id) {
    throw new Error('Lead is required');
  }

  const existing = await VehicleOrder.findOne({
    leadId: leadDoc._id,
    stage: { $nin: ['CANCELLED', 'DELIVERED'] },
  });
  if (existing) {
    if (opts.syncLead !== false) {
      await markLeadBookingDone(leadDoc, admin, opts.reason || 'Open vehicle order — booking confirmed');
    }
    return { order: existing, created: false };
  }

  const preferredModel = String(
    opts.preferredModel || leadDoc.model || '',
  ).trim();
  if (!preferredModel) {
    throw new Error('preferredModel is required (set lead model or pass preferredModel)');
  }

  const freeCount = await VehicleStock.countDocuments({
    model: preferredModel,
    status: 'FRESH_STOCK',
    isDemo: { $ne: true },
  });

  const order = await VehicleOrder.create({
    orderNumber: await nextOrderNumber(),
    stage: freeCount > 0 ? 'DRAFT' : 'AWAITING_STOCK',
    leadId: leadDoc._id,
    customerName: leadDoc.name,
    customerMobile: leadDoc.mobile,
    preferredModel,
    preferredVariant: opts.preferredVariant || undefined,
    preferredColour: opts.preferredColour || undefined,
    remarks: opts.remarks || undefined,
    createdBy: actorId(admin),
    assignedExecutive: leadDoc.assignedTo || undefined,
  });

  if (opts.syncLead !== false) {
    await markLeadBookingDone(
      leadDoc,
      admin,
      opts.reason || 'Vehicle order created from Booking',
    );
  }

  return { order, created: true };
}

/**
 * Backfill open VehicleOrders for leads already in Booking without an order.
 */
async function backfillBookingVehicleOrders(admin = null) {
  const leads = await Lead.find({
    $or: [
      { status: { $in: ['Booking', 'booking'] } },
      { 'creSheet.bookingDone': true },
    ],
  }).limit(2000);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const lead of leads) {
    if (normalizeStageLabel(lead.status) !== 'Booking' && !lead.creSheet?.bookingDone) {
      skipped += 1;
      continue;
    }
    try {
      const result = await ensureVehicleOrderForLead(lead, admin, {
        syncLead: true,
        reason: 'Backfill vehicle order for Booking lead',
      });
      if (result.created) created += 1;
      else skipped += 1;
    } catch (e) {
      failed += 1;
      errors.push({ leadId: String(lead._id), message: e.message });
    }
  }

  return { scanned: leads.length, created, skipped, failed, errors: errors.slice(0, 50) };
}

module.exports = {
  ensureVehicleOrderForLead,
  markLeadBookingDone,
  backfillBookingVehicleOrders,
  nextOrderNumber,
};
