require('../models/tdModels');

const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDRescheduleRequest = require('../models/TDRescheduleRequest');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { isoDateOnly } = require('../utils/tdSlotUtils');
const { normalizeSlotTime } = require('../utils/tdBookingSync');
const {
  isTeamScopedUser,
  assignedToStaffFilterAsync,
  assignedExecutiveFilterAsync,
  leadReadableByAdmin,
  resolveStaffIdsForUser,
  bookingAssignedToStaff,
  touchLeadActivity,
  normalizeEmail,
} = require('../utils/leadAssignment');

const TD_DURATION_MS = 60 * 60 * 1000;
const CLOSED_LEAD_STATUSES = ['Lost', 'Delivered', 'Not Interested'];

function dayBounds(from, to) {
  const start = from ? new Date(from) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date(start);
  if (!to) end.setDate(end.getDate() + 30);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function parseTypes(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function wantType(types, key) {
  if (!types.length) return true;
  // Aliases
  if (key === 'lead' && types.includes('leads')) return true;
  if (key === 'test_drive' && (types.includes('test_drives') || types.includes('td'))) return true;
  if (key === 'lead_follow_up' && (types.includes('follow_up') || types.includes('follow_ups'))) return true;
  return types.includes(key);
}

function combineDateTime(dateVal, timeStr) {
  const d = dateVal instanceof Date ? new Date(dateVal) : new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  const t = normalizeSlotTime(timeStr || '10:00');
  const [hh, mm] = t.split(':').map((n) => parseInt(n, 10));
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}

function colorForEvent(type, status) {
  const s = String(status || '').toUpperCase();
  if (s === 'CANCELLED' || s === 'LOST' || s === 'CANCELLED'.toLowerCase()) return '#9ca3af';
  if (type === 'test_drive') {
    if (s === 'COMPLETED') return '#059669';
    if (s === 'IN_PROGRESS') return '#2563eb';
    if (s === 'MISSED') return '#dc2626';
    return '#3b82f6';
  }
  if (type === 'lead') {
    if (s === 'DELIVERED') return '#059669';
    if (s === 'INTERESTED' || s === 'BOOKING') return '#d97706';
    return '#f59e0b';
  }
  if (type === 'lead_follow_up') return '#10b981';
  if (type === 'pending_approval') return '#8b5cf6';
  if (type === 'customer_appointment') return '#ec4899';
  return '#6b7280';
}

function formatLeadEvent(lead) {
  const hasFollowUp = lead.nextFollowUp && !Number.isNaN(new Date(lead.nextFollowUp).getTime());
  const startDate = hasFollowUp ? new Date(lead.nextFollowUp) : new Date(lead.createdAt);
  const allDay = !hasFollowUp;
  const start = allDay
    ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    : startDate;
  const end = allDay
    ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    : new Date(start.getTime() + TD_DURATION_MS);
  const assignee = lead.assignedTo;
  return {
    id: `lead-${lead._id}`,
    type: 'lead',
    title: `Lead · ${lead.name || 'Customer'}`,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    date: isoDateOnly(start),
    time: allDay ? null : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    status: lead.status,
    customerName: lead.name || '',
    mobile: lead.mobile || '',
    vehicle: lead.model || '',
    assignedExecutive: assignee
      ? { _id: String(assignee._id), name: assignee.name, email: assignee.email, designation: assignee.designation }
      : null,
    assignedManager: assignee?.reportsTo
      ? {
          _id: String(assignee.reportsTo._id || assignee.reportsTo),
          name: assignee.reportsTo.name,
          email: assignee.reportsTo.email,
        }
      : null,
    leadId: String(lead._id),
    remarks: lead.remarks || '',
    href: `/admin/crm/leads`,
    color: colorForEvent('lead', lead.status),
  };
}

function formatTdEvent(b) {
  const start = combineDateTime(b.slotDate, b.slotTime) || new Date(b.slotDate);
  const end = new Date(start.getTime() + TD_DURATION_MS);
  const exec = b.assignedExecutive;
  const customer = b.customerId;
  return {
    id: `td-${b._id}`,
    type: 'test_drive',
    title: `TD · ${b.customerName || customer?.name || 'Customer'}`,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    date: isoDateOnly(b.slotDate),
    time: normalizeSlotTime(b.slotTime),
    status: b.bookingStatus,
    customerName: b.customerName || customer?.name || '',
    mobile: b.customerMobile || customer?.mobile || '',
    vehicle: b.preferredModel || '',
    assignedExecutive: exec
      ? { _id: String(exec._id), name: exec.name, email: exec.email, designation: exec.designation }
      : null,
    assignedManager: exec?.reportsTo
      ? {
          _id: String(exec.reportsTo._id || exec.reportsTo),
          name: exec.reportsTo.name,
          email: exec.reportsTo.email,
        }
      : null,
    bookingId: String(b._id),
    bookingCode: b.bookingId,
    remarks: b.remarks || '',
    assignmentStatus: b.assignmentStatus,
    href: `/admin/td/bookings?highlight=${b._id}`,
    color: colorForEvent('test_drive', b.bookingStatus),
  };
}

function formatFollowUpEvent(f) {
  const lead = f.leadId;
  const start = f.scheduledAt ? new Date(f.scheduledAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    id: `fu-${f._id}`,
    type: 'lead_follow_up',
    title: `Follow-up · ${lead?.name || 'Lead'}`,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    date: isoDateOnly(start),
    time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    status: f.status || 'pending',
    customerName: lead?.name || '',
    mobile: lead?.mobile || '',
    vehicle: lead?.model || '',
    assignedExecutive: lead?.assignedTo
      ? {
          _id: String(lead.assignedTo._id || lead.assignedTo),
          name: lead.assignedTo.name,
          email: lead.assignedTo.email,
        }
      : null,
    leadId: lead?._id ? String(lead._id) : null,
    followUpId: String(f._id),
    remarks: f.note || '',
    href: lead?._id ? `/admin/crm/leads` : '/admin/crm/leads',
    color: colorForEvent('lead_follow_up', f.status),
  };
}

async function assertCanEditCalendarRecord(admin, kind, doc) {
  if (!isTeamScopedUser(admin)) return;
  if (kind === 'lead') {
    const ok = await leadReadableByAdmin(doc, admin);
    if (!ok) throw new ApiError(403, 'You cannot edit this lead');
    return;
  }
  if (kind === 'lead_follow_up') {
    const leadDoc = typeof doc.leadId === 'object' && doc.leadId ? doc.leadId : null;
    if (!leadDoc) throw new ApiError(403, 'You cannot edit this follow-up');
    const readable = await leadReadableByAdmin(leadDoc, admin);
    if (!readable) throw new ApiError(403, 'You cannot edit this follow-up');
    return;
  }
  if (kind === 'test_drive') {
    const staffIds = await resolveStaffIdsForUser(admin);
    const assigned = doc?.assignedExecutive?._id || doc?.assignedExecutive;
    if (assigned && staffIds.includes(String(assigned))) return;
    if (bookingAssignedToStaff(doc, admin._id, admin.email)) return;
    throw new ApiError(403, 'You cannot edit this test drive');
  }
}

/**
 * GET /admin/dashboard/calendar
 */
exports.getCalendarEvents = asyncHandler(async (req, res) => {
  const { start, end } = dayBounds(req.query.from, req.query.to);
  const types = parseTypes(req.query.types);
  const statusFilter = req.query.status ? String(req.query.status).trim() : '';
  const modelFilter = req.query.model || req.query.vehicle ? String(req.query.model || req.query.vehicle).trim() : '';
  const assigneeParam = req.query.assignedTo || req.query.executiveId || '';

  const events = [];
  const teamScoped = isTeamScopedUser(req.admin);

  let leadScope = null;
  let tdScope = null;
  if (teamScoped) {
    leadScope = await assignedToStaffFilterAsync(req.admin);
    tdScope = await assignedExecutiveFilterAsync(req.admin);
  }

  // Optional further narrow to one assignee (must be in scope for team users)
  let assigneeLeadFilter = null;
  let assigneeTdFilter = null;
  if (assigneeParam && assigneeParam !== 'all') {
    if (assigneeParam === 'unassigned') {
      assigneeLeadFilter = { $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] };
      assigneeTdFilter = { $or: [{ assignedExecutive: { $exists: false } }, { assignedExecutive: null }] };
    } else if (assigneeParam === 'me') {
      assigneeLeadFilter = await assignedToStaffFilterAsync(req.admin);
      // For "me" on TD use self-only by email/id via same async but for managers
      // team filter already includes self; intersect by using assignedToStaffFilter with self
      const { assignedToStaffFilter, assignedExecutiveIdsFilter } = require('../utils/leadAssignment');
      assigneeLeadFilter = assignedToStaffFilter(req.admin._id, req.admin.email);
      assigneeTdFilter = assignedExecutiveIdsFilter([req.admin._id], req.admin.email);
    } else {
      if (teamScoped) {
        const allowed = await resolveStaffIdsForUser(req.admin);
        if (!allowed.includes(String(assigneeParam))) {
          return successResponse(res, [], undefined, 200, {
            from: isoDateOnly(start),
            to: isoDateOnly(end),
            count: 0,
          });
        }
      }
      const TDStaff = require('../models/TDStaff');
      const staff = await TDStaff.findById(assigneeParam).select('email').lean();
      const { assignedToStaffFilter, assignedExecutiveIdsFilter } = require('../utils/leadAssignment');
      assigneeLeadFilter = assignedToStaffFilter(assigneeParam, staff?.email);
      assigneeTdFilter = assignedExecutiveIdsFilter([assigneeParam], staff?.email);
    }
  }

  if (wantType(types, 'test_drive')) {
    const query = {
      slotDate: { $gte: start, $lte: end },
      bookingStatus: { $nin: statusFilter ? [] : ['CANCELLED'] },
    };
    if (statusFilter) query.bookingStatus = statusFilter.toUpperCase();
    if (modelFilter) query.preferredModel = new RegExp(modelFilter, 'i');

    const and = [];
    if (tdScope) and.push(tdScope);
    if (assigneeTdFilter) and.push(assigneeTdFilter);
    if (and.length) query.$and = and;

    const bookings = await TDBooking.find(query)
      .populate({
        path: 'assignedExecutive',
        select: 'name email designation reportsTo',
        populate: { path: 'reportsTo', select: 'name email designation' },
      })
      .populate('customerId', 'name mobile')
      .select(
        'bookingId bookingStatus slotDate slotTime preferredModel customerName customerMobile assignmentStatus remarks assignedExecutive',
      )
      .limit(1000)
      .lean();

    for (const b of bookings) events.push(formatTdEvent(b));
  }

  if (wantType(types, 'lead')) {
    const query = {
      status: { $nin: CLOSED_LEAD_STATUSES },
      $or: [
        { nextFollowUp: { $gte: start, $lte: end } },
        {
          $and: [
            { $or: [{ nextFollowUp: { $exists: false } }, { nextFollowUp: null }] },
            { createdAt: { $gte: start, $lte: end } },
          ],
        },
      ],
    };
    if (statusFilter) query.status = statusFilter;
    if (modelFilter) query.model = new RegExp(modelFilter, 'i');

    const and = [];
    if (leadScope) and.push(leadScope);
    if (assigneeLeadFilter) and.push(assigneeLeadFilter);
    if (and.length) query.$and = and;

    const leads = await Lead.find(query)
      .populate({
        path: 'assignedTo',
        select: 'name email designation reportsTo',
        populate: { path: 'reportsTo', select: 'name email designation' },
      })
      .select('name mobile model status nextFollowUp createdAt remarks assignedTo')
      .limit(1000)
      .lean();

    for (const lead of leads) events.push(formatLeadEvent(lead));
  }

  if (wantType(types, 'lead_follow_up') || wantType(types, 'follow_up')) {
    const fuQuery = { scheduledAt: { $gte: start, $lte: end } };
    if (statusFilter) fuQuery.status = statusFilter.toLowerCase();

    let followUps = await LeadFollowUp.find(fuQuery)
      .populate({
        path: 'leadId',
        select: 'name mobile model status assignedTo',
        populate: { path: 'assignedTo', select: 'name email designation' },
      })
      .select('leadId scheduledAt status note')
      .limit(1000)
      .lean()
      .catch(() => []);

    if (teamScoped && followUps?.length) {
      const allowedIds = new Set(await resolveStaffIdsForUser(req.admin));
      const email = normalizeEmail(req.admin.email);
      followUps = followUps.filter((f) => {
        const lead = f.leadId;
        if (!lead) return false;
        const assigned = lead.assignedTo?._id || lead.assignedTo;
        if (assigned && allowedIds.has(String(assigned))) return true;
        if (email && normalizeEmail(lead.assignedToEmail) === email) return true;
        if (email && normalizeEmail(lead.assignedTo?.email) === email) return true;
        return false;
      });
    }

    if (assigneeParam && assigneeParam !== 'all' && assigneeParam !== 'unassigned') {
      const target = assigneeParam === 'me' ? String(req.admin._id) : String(assigneeParam);
      followUps = (followUps || []).filter((f) => {
        const assigned = f.leadId?.assignedTo?._id || f.leadId?.assignedTo;
        return assigned && String(assigned) === target;
      });
    }

    if (modelFilter) {
      followUps = (followUps || []).filter((f) =>
        String(f.leadId?.model || '')
          .toLowerCase()
          .includes(modelFilter.toLowerCase()),
      );
    }

    for (const f of followUps || []) {
      const ev = formatFollowUpEvent(f);
      if (ev) events.push(ev);
    }
  }

  // Keep optional ops events for admins when no type filter or explicitly requested
  if (wantType(types, 'pending_approval') && !teamScoped) {
    const approvals = await TDBooking.find({
      approvalStatus: 'PENDING',
      createdAt: { $gte: start, $lte: end },
    })
      .select('bookingId customerName createdAt')
      .limit(200)
      .lean();
    for (const b of approvals) {
      events.push({
        id: `ap-${b._id}`,
        type: 'pending_approval',
        title: `Repeat TD approval · ${b.bookingId}`,
        start: new Date(b.createdAt).toISOString(),
        end: new Date(new Date(b.createdAt).getTime() + TD_DURATION_MS).toISOString(),
        allDay: true,
        date: isoDateOnly(b.createdAt),
        time: null,
        status: 'PENDING',
        customerName: b.customerName || '',
        mobile: '',
        vehicle: '',
        href: `/admin/td/bookings?approvals=1&highlight=${b._id}`,
        color: colorForEvent('pending_approval', 'PENDING'),
      });
    }
  }

  if (wantType(types, 'reschedule') && !teamScoped) {
    const reschedules = await TDRescheduleRequest.find({
      status: 'PENDING',
      createdAt: { $gte: start, $lte: end },
    })
      .select('bookingCode createdAt requestedByName')
      .limit(200)
      .lean();
    for (const r of reschedules) {
      events.push({
        id: `rs-${r._id}`,
        type: 'customer_appointment',
        title: `Reschedule request · ${r.bookingCode}`,
        start: new Date(r.createdAt).toISOString(),
        end: new Date(new Date(r.createdAt).getTime() + TD_DURATION_MS).toISOString(),
        allDay: true,
        date: isoDateOnly(r.createdAt),
        time: null,
        status: 'PENDING',
        customerName: r.requestedByName || '',
        mobile: '',
        vehicle: '',
        href: `/admin/td/reschedule-history?pending=1`,
        color: colorForEvent('customer_appointment', 'PENDING'),
      });
    }
  }

  events.sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));

  return successResponse(res, events, undefined, 200, {
    from: isoDateOnly(start),
    to: isoDateOnly(end),
    count: events.length,
  });
});

/**
 * PATCH /admin/dashboard/calendar/events/:id
 * Body: { start?, end?, date?, time?, allDay? }
 */
exports.patchCalendarEvent = asyncHandler(async (req, res) => {
  const rawId = String(req.params.id || '');
  const m = rawId.match(/^(td|lead|fu|ap|rs)-(.+)$/);
  if (!m) throw new ApiError(400, 'Invalid calendar event id');
  const kind = m[1];
  const mongoId = m[2];

  const body = req.body || {};
  let startDate = body.start ? new Date(body.start) : null;
  if ((!startDate || Number.isNaN(startDate.getTime())) && body.date) {
    startDate = combineDateTime(body.date, body.time || '10:00');
  }
  if (!startDate || Number.isNaN(startDate.getTime())) {
    throw new ApiError(400, 'Provide a valid start or date/time');
  }

  if (kind === 'td') {
    const doc = await TDBooking.findById(mongoId);
    if (!doc) throw new ApiError(404, 'Test drive booking not found');
    await assertCanEditCalendarRecord(req.admin, 'test_drive', doc);

    const slotDate = new Date(startDate);
    slotDate.setHours(0, 0, 0, 0);
    doc.slotDate = slotDate;
    doc.slotTime = normalizeSlotTime(
      body.time ||
        `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
    );
    await doc.save();
    await doc.populate({
      path: 'assignedExecutive',
      select: 'name email designation reportsTo',
      populate: { path: 'reportsTo', select: 'name email' },
    });
    await doc.populate('customerId', 'name mobile');
    return successResponse(res, formatTdEvent(doc.toObject ? doc.toObject() : doc), 'Test drive rescheduled');
  }

  if (kind === 'lead') {
    const doc = await Lead.findById(mongoId);
    if (!doc) throw new ApiError(404, 'Lead not found');
    await assertCanEditCalendarRecord(req.admin, 'lead', doc);
    doc.nextFollowUp = startDate;
    touchLeadActivity(doc);
    await doc.save();
    await doc.populate({
      path: 'assignedTo',
      select: 'name email designation reportsTo',
      populate: { path: 'reportsTo', select: 'name email' },
    });
    return successResponse(res, formatLeadEvent(doc.toObject ? doc.toObject() : doc), 'Lead follow-up date updated');
  }

  if (kind === 'fu') {
    const doc = await LeadFollowUp.findById(mongoId).populate({
      path: 'leadId',
      select: 'name mobile model status assignedTo assignedToEmail',
      populate: { path: 'assignedTo', select: 'name email designation' },
    });
    if (!doc) throw new ApiError(404, 'Follow-up not found');
    await assertCanEditCalendarRecord(req.admin, 'lead_follow_up', doc);
    doc.scheduledAt = startDate;
    await doc.save();

    if (doc.leadId?._id) {
      const lead = await Lead.findById(doc.leadId._id);
      if (lead && doc.status === 'pending') {
        if (!lead.nextFollowUp || startDate < new Date(lead.nextFollowUp)) {
          lead.nextFollowUp = startDate;
          touchLeadActivity(lead);
          await lead.save();
        }
      }
    }

    const ev = formatFollowUpEvent(doc.toObject ? doc.toObject() : doc);
    return successResponse(res, ev, 'Follow-up rescheduled');
  }

  throw new ApiError(400, 'This event type cannot be rescheduled from the calendar');
});
