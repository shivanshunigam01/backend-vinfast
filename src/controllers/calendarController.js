require('../models/tdModels');

const TDBooking = require('../models/TDBooking');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDRescheduleRequest = require('../models/TDRescheduleRequest');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { isoDateOnly } = require('../utils/tdSlotUtils');

function dayBounds(from, to) {
  const start = from ? new Date(from) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date(start);
  if (!to) end.setDate(end.getDate() + 30);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Centralized calendar dashboard events with deep-link paths for the admin SPA.
 */
exports.getCalendarEvents = asyncHandler(async (req, res) => {
  const { start, end } = dayBounds(req.query.from, req.query.to);
  const types = String(req.query.types || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const want = (key) => types.length === 0 || types.includes(key);

  const events = [];

  if (want('test_drive')) {
    const bookings = await TDBooking.find({
      slotDate: { $gte: start, $lte: end },
      bookingStatus: { $nin: ['CANCELLED'] },
    })
      .select('bookingId bookingStatus slotDate slotTime preferredModel customerName assignmentStatus')
      .limit(500);
    for (const b of bookings) {
      events.push({
        id: `td-${b._id}`,
        type: 'test_drive',
        title: `TD ${b.bookingId} · ${b.customerName || 'Customer'}`,
        date: isoDateOnly(b.slotDate),
        time: b.slotTime,
        status: b.bookingStatus,
        href: `/admin/td/bookings?highlight=${b._id}`,
        meta: { preferredModel: b.preferredModel, assignmentStatus: b.assignmentStatus },
      });
    }
  }

  if (want('follow_up')) {
    const followUps = await LeadFollowUp.find({
      scheduledAt: { $gte: start, $lte: end },
    })
      .select('leadId scheduledAt status note')
      .populate('leadId', 'name mobile leadId')
      .limit(500)
      .catch(() => []);
    for (const f of followUps || []) {
      events.push({
        id: `fu-${f._id}`,
        type: 'lead_follow_up',
        title: `Follow-up · ${f.leadId?.name || 'Lead'}`,
        date: f.scheduledAt ? isoDateOnly(f.scheduledAt) : null,
        time: f.scheduledAt ? new Date(f.scheduledAt).toTimeString().slice(0, 5) : null,
        status: f.status || 'PENDING',
        href: f.leadId?._id ? `/admin/crm/leads/${f.leadId._id}` : '/admin/crm/leads',
        meta: { note: f.note },
      });
    }
  }

  if (want('pending_approval')) {
    const approvals = await TDBooking.find({
      approvalStatus: 'PENDING',
      createdAt: { $gte: start, $lte: end },
    })
      .select('bookingId customerName createdAt')
      .limit(200);
    for (const b of approvals) {
      events.push({
        id: `ap-${b._id}`,
        type: 'pending_approval',
        title: `Repeat TD approval · ${b.bookingId}`,
        date: isoDateOnly(b.createdAt),
        time: null,
        status: 'PENDING',
        href: `/admin/td/bookings?approvals=1&highlight=${b._id}`,
      });
    }
  }

  if (want('reschedule')) {
    const reschedules = await TDRescheduleRequest.find({
      status: 'PENDING',
      createdAt: { $gte: start, $lte: end },
    })
      .select('bookingCode createdAt requestedByName')
      .limit(200);
    for (const r of reschedules) {
      events.push({
        id: `rs-${r._id}`,
        type: 'customer_appointment',
        title: `Reschedule request · ${r.bookingCode}`,
        date: isoDateOnly(r.createdAt),
        time: null,
        status: 'PENDING',
        href: `/admin/td/reschedule-history?pending=1`,
        meta: { requestedByName: r.requestedByName },
      });
    }
  }

  events.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || '')));

  return successResponse(res, events, undefined, 200, {
    from: isoDateOnly(start),
    to: isoDateOnly(end),
    count: events.length,
  });
});
