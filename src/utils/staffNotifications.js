const StaffNotification = require('../models/StaffNotification');
const TDStaff = require('../models/TDStaff');

function leadHref(leadId) {
  return leadId ? `/admin/crm/leads?lead=${leadId}` : '/admin/crm/leads';
}

function tdHref(bookingId) {
  return bookingId ? `/admin/td/bookings?id=${bookingId}` : '/admin/td/bookings';
}

function displayLeadName(lead) {
  if (!lead) return 'Customer';
  return lead.customerName || lead.name || 'Customer';
}

async function emitStaffNotification(payload = {}) {
  const recipientId = payload.recipientId;
  if (!recipientId) return null;
  if (payload.actorId && String(payload.actorId) === String(recipientId) && payload.skipSelf !== false) {
    // Still notify self for due/overdue reminders.
    if (!['follow_up_due', 'follow_up_overdue', 'td_due', 'favourite_inactive'].includes(payload.type)) {
      return null;
    }
  }

  const doc = {
    recipientId,
    actorId: payload.actorId || undefined,
    type: payload.type || 'info',
    title: String(payload.title || 'Update').trim(),
    body: payload.body ? String(payload.body).trim() : undefined,
    customerName: payload.customerName ? String(payload.customerName).trim() : undefined,
    leadId: payload.leadId || undefined,
    href: payload.href || leadHref(payload.leadId),
    priority: payload.priority || 'info',
    dedupeKey: payload.dedupeKey || undefined,
  };

  try {
    if (doc.dedupeKey) {
      return await StaffNotification.findOneAndUpdate(
        { dedupeKey: doc.dedupeKey },
        { $setOnInsert: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    return await StaffNotification.create(doc);
  } catch (err) {
    if (err?.code === 11000) return null;
    console.error('[staffNotifications]', err.message);
    return null;
  }
}

async function notifyLeadAssignees(lead, payload) {
  const ids = new Set();
  if (lead?.assignedTo) ids.add(String(lead.assignedTo._id || lead.assignedTo));
  if (payload.notifyManager !== false && lead?.assignedTo) {
    const mgr = await managerOf(lead.assignedTo._id || lead.assignedTo);
    if (mgr) ids.add(String(mgr));
  }
  for (const id of ids) {
    await emitStaffNotification({
      ...payload,
      recipientId: id,
      leadId: lead._id,
      customerName: payload.customerName || displayLeadName(lead),
    });
  }
}

async function managerOf(staffId) {
  if (!staffId) return null;
  const staff = await TDStaff.findById(staffId).select('reportsTo').lean();
  return staff?.reportsTo || null;
}

async function notifyTdEvent(booking, { type, title, priority = 'info', actorId } = {}) {
  if (!booking) return null;
  const execId = booking.assignedExecutive?._id || booking.assignedExecutive;
  const customerName = booking.customerId?.name || booking.customerName;
  const recipients = new Set();
  if (execId) recipients.add(String(execId));
  for (const id of recipients) {
    await emitStaffNotification({
      recipientId: id,
      actorId,
      type,
      title,
      body: `${customerName || 'Customer'} · ${booking.preferredModel || booking.model || ''}`.trim(),
      customerName,
      href: tdHref(booking._id),
      priority,
    });
  }
}

module.exports = {
  emitStaffNotification,
  notifyLeadAssignees,
  notifyTdEvent,
  managerOf,
  leadHref,
  tdHref,
  displayLeadName,
};
