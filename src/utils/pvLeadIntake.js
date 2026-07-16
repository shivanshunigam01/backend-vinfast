const PVCustomer = require('../models/PVCustomer');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const { CRM_LEAD_STAGES, normalizeStageLabel } = require('../constants/leadStages');
const { normalizeLeadModelForStorage } = require('./leadModel');
const { touchLeadActivity } = require('./leadAssignment');
const { nextCustomerId, nextLeadId, nextOpportunityId } = require('./pvIdGenerator');

function pickStr(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

async function ensureParentCustomer({ name, mobile, email, city, otherCity }) {
  const mobileNorm = pickStr(mobile);
  if (!mobileNorm) throw new Error('Mobile is required for customer');

  let customer = await PVCustomer.findOne({ mobile: mobileNorm, isSubCustomer: { $ne: true } });
  if (!customer) {
    customer = await PVCustomer.create({
      customerId: await nextCustomerId(),
      name: pickStr(name) || 'Customer',
      mobile: mobileNorm,
      email: email || undefined,
      city: city || undefined,
      otherCity: otherCity || undefined,
      isSubCustomer: false,
    });
    return customer;
  }

  let changed = false;
  if (name && customer.name !== name) {
    customer.name = name;
    changed = true;
  }
  if (email && !customer.email) {
    customer.email = email;
    changed = true;
  }
  if (city && !customer.city) {
    customer.city = city;
    changed = true;
  }
  if (otherCity && !customer.otherCity) {
    customer.otherCity = otherCity;
    changed = true;
  }
  if (changed) await customer.save();
  return customer;
}

async function ensureSubCustomer(parent, subCustomer = {}) {
  const subName = pickStr(subCustomer.name);
  const subMobile = pickStr(subCustomer.mobile, parent.mobile);
  const vehicleRegistration = pickStr(subCustomer.vehicleRegistration);
  if (!subName && !vehicleRegistration) return null;

  let sub = await PVCustomer.findOne({
    parentCustomer: parent._id,
    mobile: subMobile,
    name: subName || undefined,
  });

  if (!sub) {
    sub = await PVCustomer.create({
      customerId: await nextCustomerId(),
      name: subName || `${parent.name} (Sub)`,
      mobile: subMobile,
      email: subCustomer.email || undefined,
      city: subCustomer.city || parent.city,
      parentCustomer: parent._id,
      isSubCustomer: true,
      vehicleRegistration: vehicleRegistration || undefined,
    });
    return sub;
  }

  if (vehicleRegistration && sub.vehicleRegistration !== vehicleRegistration) {
    sub.vehicleRegistration = vehicleRegistration;
    await sub.save();
  }
  return sub;
}

async function assignPvIds(leadDoc) {
  if (!leadDoc.leadId) leadDoc.leadId = await nextLeadId();
  if (!leadDoc.opportunityId) leadDoc.opportunityId = await nextOpportunityId();
  return leadDoc;
}

/** Stages after which a customer may legitimately open a brand-new lead. */
const CLOSED_LEAD_STATUSES = ['Lost', 'Delivered', 'Not Interested'];

/**
 * The customer's open (not Lost/Delivered) lead, newest first. Used to
 * dedupe intake by mobile: one open lead/opportunity per customer.
 */
async function findOpenLeadForCustomer({ parentId, mobile }) {
  const or = [];
  if (parentId) or.push({ pvCustomerId: parentId });
  const mobileNorm = pickStr(mobile);
  if (mobileNorm) or.push({ mobile: mobileNorm });
  if (!or.length) return null;
  return Lead.findOne({ $or: or, status: { $nin: CLOSED_LEAD_STATUSES } }).sort({ createdAt: -1 });
}

/**
 * Central intake: one parent customer per mobile, new lead + opportunity per intake.
 * Meta leads upsert by metaUniqueId. TD leads upsert by tdBookingId when provided.
 */
async function intakePvLead(input = {}) {
  const {
    name,
    mobile,
    email,
    city,
    otherCity,
    model,
    source = 'Website',
    status = 'Enquiry',
    interest,
    remarks,
    financeNeeded,
    exchangeNeeded,
    assignedTo,
    assignedToEmail,
    utmSource,
    utmMedium,
    utmCampaign,
    pageSource,
    metaUniqueId,
    enquiryId,
    testDriveId,
    tdBookingId,
    subCustomer,
    vehicleRegistration,
    referredByCustomerId,
    referredByMobile,
    changedBy,
    historyReason,
  } = input;

  const parent = await ensureParentCustomer({ name, mobile, email, city, otherCity });
  const sub = subCustomer
    ? await ensureSubCustomer(parent, subCustomer)
    : vehicleRegistration
      ? await ensureSubCustomer(parent, { vehicleRegistration, name: pickStr(name), mobile: parent.mobile })
      : null;

  const modelNorm = normalizeLeadModelForStorage(model || 'VF 7');
  const leadPatch = {
    pvCustomerId: parent._id,
    subCustomerId: sub?._id,
    vehicleRegistration: pickStr(vehicleRegistration, sub?.vehicleRegistration) || undefined,
    name: pickStr(name, parent.name),
    mobile: parent.mobile,
    email: email || parent.email,
    city: pickStr(city, parent.city) || 'Unknown',
    otherCity: otherCity || parent.otherCity,
    model: modelNorm,
    interest,
    source,
    status,
    remarks,
    financeNeeded: Boolean(financeNeeded),
    exchangeNeeded: Boolean(exchangeNeeded),
    assignedTo: assignedTo || undefined,
    assignedToEmail: assignedToEmail || undefined,
    utmSource,
    utmMedium,
    utmCampaign,
    pageSource,
    metaUniqueId: metaUniqueId || undefined,
    enquiryId: enquiryId || undefined,
    testDriveId: testDriveId || undefined,
    tdBookingId: tdBookingId || undefined,
    referredByCustomerId: referredByCustomerId || undefined,
    referredByMobile: referredByMobile || undefined,
    lastActivityAt: new Date(),
  };

  let lead = null;
  let isNew = false;

  if (metaUniqueId) {
    lead = await Lead.findOne({ metaUniqueId: String(metaUniqueId).trim() });
  } else if (tdBookingId) {
    lead = await Lead.findOne({ tdBookingId });
  }

  // Duplicate guard: same mobile re-enquiring (website form, walk-in, another
  // test drive) updates the customer's open lead instead of creating a second
  // lead/opportunity. A new lead is only created after the previous one closed
  // (Lost/Delivered). Test drive bookings stay unlimited — TDBooking records
  // are separate; the lead simply links to the latest booking.
  if (!lead) {
    lead = await findOpenLeadForCustomer({ parentId: parent._id, mobile: parent.mobile });
  }

  if (lead) {
    // Re-syncs (Meta webhooks, TD booking updates) must not drag an advanced
    // lead back down the pipeline — keep the further-along stage. A "Lost"
    // lead is the exception: a fresh intake means the customer re-engaged.
    const prevStage = normalizeStageLabel(lead.status);
    const currentIdx = CRM_LEAD_STAGES.indexOf(prevStage);
    const incomingIdx = CRM_LEAD_STAGES.indexOf(normalizeStageLabel(status));
    const keepCurrentStatus = prevStage !== 'Lost' && incomingIdx !== -1 && currentIdx > incomingIdx;

    const prevStatus = lead.status;
    Object.assign(lead, leadPatch);
    if (keepCurrentStatus) lead.status = prevStatus;
    touchLeadActivity(lead);
    if (!lead.leadId || !lead.opportunityId) await assignPvIds(lead);
    await lead.save();
  } else {
    isNew = true;
    lead = await Lead.create({
      ...leadPatch,
      leadId: await nextLeadId(),
      opportunityId: await nextOpportunityId(),
    });
  }

  if (isNew && changedBy) {
    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: tdBookingId || undefined,
      toStage: status,
      changedBy,
      reason: historyReason || `Lead created from ${source}`,
    });
  }

  return { lead, parent, subCustomer: sub, isNew };
}

module.exports = {
  intakePvLead,
  ensureParentCustomer,
  ensureSubCustomer,
  assignPvIds,
  findOpenLeadForCustomer,
  CLOSED_LEAD_STATUSES,
};
