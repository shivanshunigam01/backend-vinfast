const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDBooking = require('../models/TDBooking');
const { upsertTDCustomer } = require('./tdCustomerResolver');
const { nextBookingId, resolveBranch, normalizeSlotTime } = require('./tdBookingSync');
const { touchLeadActivity } = require('./leadAssignment');

/** CRE Current Format follow-up column pairs → note prefixes used at import. */
const FOLLOW_UP_SLOT_DEFS = [
  {
    creDateKey: 'cre follow up call 1 date',
    creRemarkKey: 'cre follow up call remark 1',
    salesDateKey: 'sales person follow up call 1 date',
    salesRemarkKey: 'sales person follow up call 1 remark 1',
    crePrefix: 'CRE #1: ',
    salesPrefix: 'Sales #1: ',
  },
  {
    creDateKey: 'cre follow up call 2 date',
    creRemarkKey: 'cre follow up call remark 2',
    salesDateKey: 'sales person follow up call remark 2 date',
    salesRemarkKey: 'sales person follow up call remark 2',
    crePrefix: 'CRE #2: ',
    salesPrefix: 'Sales #2: ',
  },
  {
    creDateKey: 'cre follow up call 3 date',
    creRemarkKey: 'cre follow up call remark 3',
    salesDateKey: 'sales person follow up call remark 3 date',
    salesRemarkKey: 'sales person follow up call remark 3',
    crePrefix: 'CRE #3: ',
    salesPrefix: 'Sales #3: ',
  },
];

function parseDateInput(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function followUpRowKey(note, scheduledAt) {
  const day = scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 10) : '';
  return `${String(note || '').trim().toLowerCase()}|${day}`;
}

/** Extract the 3 CRE/Sales follow-up pairs from stored LeadFollowUp rows. */
function extractFollowUpSlots(followUps = []) {
  return FOLLOW_UP_SLOT_DEFS.map((def) => {
    const cre = followUps.find((f) => String(f.note || '').startsWith(def.crePrefix));
    const sales = followUps.find((f) => String(f.note || '').startsWith(def.salesPrefix));
    return {
      creDate: cre?.scheduledAt || cre?.completedAt || null,
      creRemark: cre ? String(cre.note).slice(def.crePrefix.length).trim() : '',
      creFollowUpId: cre?._id || null,
      salesDate: sales?.scheduledAt || sales?.completedAt || null,
      salesRemark: sales ? String(sales.note).slice(def.salesPrefix.length).trim() : '',
      salesFollowUpId: sales?._id || null,
    };
  });
}

async function upsertPrefixedFollowUp({ leadId, adminId, prefix, remark, dateVal, existingId }) {
  const text = String(remark || '').trim();
  if (!text) {
    if (existingId) await LeadFollowUp.deleteOne({ _id: existingId, leadId });
    return null;
  }
  const note = `${prefix}${text}`;
  const scheduled = parseDateInput(dateVal);
  const isCompleted = !scheduled || scheduled <= new Date();
  const payload = {
    note,
    scheduledAt: scheduled || undefined,
    completedAt: isCompleted ? scheduled || new Date() : undefined,
    status: isCompleted ? 'completed' : 'pending',
  };

  if (existingId) {
    await LeadFollowUp.updateOne({ _id: existingId, leadId }, { $set: payload });
    return existingId;
  }

  const doc = await LeadFollowUp.create({
    leadId,
    createdBy: adminId,
    ...payload,
  });
  return doc._id;
}

/** Persist CRE/Sales follow-up column pairs onto LeadFollowUp records. */
async function syncStructuredFollowUpSlots(leadId, adminId, slots = []) {
  if (!Array.isArray(slots) || !slots.length) return 0;
  const existing = await LeadFollowUp.find({ leadId }).lean();
  const extracted = extractFollowUpSlots(existing);
  let changed = 0;

  for (let i = 0; i < FOLLOW_UP_SLOT_DEFS.length; i += 1) {
    const slot = slots[i] || {};
    const prev = extracted[i] || {};
    const def = FOLLOW_UP_SLOT_DEFS[i];

    const creId = await upsertPrefixedFollowUp({
      leadId,
      adminId,
      prefix: def.crePrefix,
      remark: slot.creRemark,
      dateVal: slot.creDate,
      existingId: prev.creFollowUpId,
    });
    if (creId !== prev.creFollowUpId) changed += 1;

    const salesId = await upsertPrefixedFollowUp({
      leadId,
      adminId,
      prefix: def.salesPrefix,
      remark: slot.salesRemark,
      dateVal: slot.salesDate,
      existingId: prev.salesFollowUpId,
    });
    if (salesId !== prev.salesFollowUpId) changed += 1;
  }

  return changed;
}

function pickLeadStr(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

/** Create or update a TD booking from imported / edited creSheet TD columns (for reports). */
async function syncTestDriveBookingFromCreSheet(lead, { assigneeId } = {}) {
  let row = lead;
  if (!pickLeadStr(lead?.name) || !pickLeadStr(lead?.mobile)) {
    const full = await Lead.findById(lead._id).select(
      'name mobile email city model creSheet tdBookingId assignedTo',
    );
    if (full) row = full;
  }

  const cs = row.creSheet || {};
  const tdDate = parseDateInput(cs.tdDate);
  const tdDone = cs.tdDone === true;
  // Only create TD bookings when test drive is marked done (Yes).
  if (!tdDone) return null;

  const slotDate = tdDate || new Date();
  const customer = await upsertTDCustomer({
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    city: row.city,
  });
  const branchDoc = await resolveBranch(null);

  let booking = row.tdBookingId ? await TDBooking.findById(row.tdBookingId) : null;
  if (!booking) {
    booking = await TDBooking.findOne({
      leadId: row._id,
      bookingStatus: { $ne: 'CANCELLED' },
    }).sort({ createdAt: -1 });
  }

  const bookingStatus = tdDone ? 'COMPLETED' : 'CONFIRMED';
  const payload = {
    slotDate,
    slotTime: booking?.slotTime || normalizeSlotTime('10:00'),
    slotDuration: booking?.slotDuration || 60,
    preferredModel: row.model,
    bookingStatus,
    customerId: customer._id,
    branchId: branchDoc._id,
    leadId: row._id,
    customerName: row.name,
    customerMobile: row.mobile,
    customerEmail: row.email,
    customerCity: row.city,
    remarks: cs.afterTdRemark || cs.tdNotDoneWhy || undefined,
    importMonthYear: cs.monthYearTd || cs.monthYear || undefined,
    approvalStatus: 'NOT_REQUIRED',
    assignmentStatus: assigneeId ? 'ACCEPTED' : 'UNASSIGNED',
  };

  if (assigneeId) {
    payload.assignedExecutive = assigneeId;
  } else {
    payload.assignedExecutive = undefined;
    payload.assignedExecutiveEmail = undefined;
  }

  if (booking) {
    Object.assign(booking, payload);
    if (!assigneeId) {
      booking.assignedExecutive = undefined;
      booking.assignedExecutiveEmail = undefined;
    }
    if (cs.monthYearTd || cs.monthYear) {
      booking.set('importMonthYear', cs.monthYearTd || cs.monthYear);
    }
    await booking.save();
  } else {
    booking = await TDBooking.create({
      bookingId: nextBookingId(),
      ...payload,
      ...(cs.monthYearTd || cs.monthYear
        ? { importMonthYear: cs.monthYearTd || cs.monthYear }
        : {}),
    });
  }

  row.tdBookingId = booking._id;
  touchLeadActivity(row);
  await row.save();
  return booking;
}

module.exports = {
  FOLLOW_UP_SLOT_DEFS,
  extractFollowUpSlots,
  syncStructuredFollowUpSlots,
  syncTestDriveBookingFromCreSheet,
  followUpRowKey,
};
