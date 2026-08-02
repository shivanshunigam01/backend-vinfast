require('../models/tdModels');

const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadStageHistory = require('../models/LeadStageHistory');
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
const QUERY_LIMIT = 2500;
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
  if (key === 'new_lead' && (types.includes('new_leads') || types.includes('leads_new'))) return true;
  if (key === 'test_drive' && (types.includes('test_drives') || types.includes('td'))) return true;
  if (key === 'lead_follow_up' && (types.includes('follow_up') || types.includes('follow_ups'))) return true;
  if (key === 'stage_activity' && (types.includes('stage') || types.includes('stage_activities'))) return true;
  if (key === 'booking_update' && (types.includes('booking') || types.includes('bookings'))) return true;
  if (key === 'delivery' && types.includes('deliveries')) return true;
  if (key === 'sales_activity' && (types.includes('sales') || types.includes('assignment'))) return true;
  if (key === 'awaiting_vehicle' && types.includes('awaiting')) return true;
  if (key === 'pending_approval' && (types.includes('approvals') || types.includes('approval'))) return true;
  if (
    key === 'customer_appointment' &&
    (types.includes('reschedule') ||
      types.includes('reschedules') ||
      types.includes('meeting') ||
      types.includes('meetings'))
  ) {
    return true;
  }
  if (key === 'reschedule' && (types.includes('customer_appointment') || types.includes('reschedule'))) {
    return true;
  }
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

function leadHref(id) {
  return id ? `/admin/crm/leads?leadId=${id}` : '/admin/crm/leads';
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
  if (type === 'new_lead') return '#0ea5e9';
  if (type === 'lead') {
    if (s === 'DELIVERED') return '#059669';
    if (s === 'INTERESTED' || s === 'BOOKING') return '#d97706';
    return '#f59e0b';
  }
  if (type === 'lead_follow_up') return '#10b981';
  if (type === 'stage_activity') return '#6366f1';
  if (type === 'booking_update') return '#d97706';
  if (type === 'delivery') return '#059669';
  if (type === 'sales_activity') return '#14b8a6';
  if (type === 'awaiting_vehicle') return '#f97316';
  if (type === 'pending_approval') return '#8b5cf6';
  if (type === 'customer_appointment') return '#ec4899';
  return '#6b7280';
}

function allDayRange(dateVal) {
  const start = new Date(dateVal);
  if (Number.isNaN(start.getTime())) return null;
  const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  return { start: dayStart, end: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) };
}

function assigneeBlock(assignee) {
  return {
    assignedExecutive: assignee
      ? {
          _id: String(assignee._id || assignee),
          name: assignee.name,
          email: assignee.email,
          designation: assignee.designation,
        }
      : null,
    assignedManager: assignee?.reportsTo
      ? {
          _id: String(assignee.reportsTo._id || assignee.reportsTo),
          name: assignee.reportsTo.name,
          email: assignee.reportsTo.email,
        }
      : null,
  };
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
    title: `Follow-up due · ${lead.name || 'Customer'}`,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    date: isoDateOnly(start),
    time: allDay ? null : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    status: lead.status,
    customerName: lead.name || '',
    mobile: lead.mobile || '',
    vehicle: lead.model || '',
    ...assigneeBlock(assignee),
    leadId: String(lead._id),
    remarks: lead.remarks || '',
    href: leadHref(lead._id),
    color: colorForEvent('lead', lead.status),
  };
}

function formatNewLeadEvent(lead) {
  const range = allDayRange(lead.createdAt);
  if (!range) return null;
  const assignee = lead.assignedTo;
  return {
    id: `nl-${lead._id}`,
    type: 'new_lead',
    title: `New lead · ${lead.name || 'Customer'}`,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    allDay: true,
    date: isoDateOnly(range.start),
    time: null,
    status: lead.status,
    customerName: lead.name || '',
    mobile: lead.mobile || '',
    vehicle: lead.model || '',
    ...assigneeBlock(assignee),
    leadId: String(lead._id),
    remarks: lead.remarks || '',
    href: leadHref(lead._id),
    color: colorForEvent('new_lead', lead.status),
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
    leadId: b.leadId ? String(b.leadId) : null,
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
  const leadId = lead?._id ? String(lead._id) : null;
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
    leadId,
    followUpId: String(f._id),
    remarks: f.note || '',
    href: leadHref(leadId),
    color: colorForEvent('lead_follow_up', f.status),
  };
}

function formatStageActivityEvent(h) {
  const lead = h.leadId;
  const start = h.createdAt ? new Date(h.createdAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const leadId = lead?._id ? String(lead._id) : h.leadId ? String(h.leadId) : null;
  const from = h.fromStage || '—';
  const to = h.toStage || '—';
  return {
    id: `sa-${h._id}`,
    type: 'stage_activity',
    title: `Stage · ${lead?.name || 'Lead'} · ${from} → ${to}`,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    date: isoDateOnly(start),
    time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    status: to,
    customerName: lead?.name || '',
    mobile: lead?.mobile || '',
    vehicle: lead?.model || '',
    ...assigneeBlock(lead?.assignedTo),
    leadId,
    remarks: h.reason || '',
    href: leadHref(leadId),
    color: colorForEvent('stage_activity', to),
  };
}

function formatBookingUpdateEvent(lead, dateVal) {
  const range = allDayRange(dateVal);
  if (!range) return null;
  return {
    id: `bk-${lead._id}-${isoDateOnly(range.start)}`,
    type: 'booking_update',
    title: `Booking · ${lead.name || 'Customer'}`,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    allDay: true,
    date: isoDateOnly(range.start),
    time: null,
    status: lead.status || 'Booking',
    customerName: lead.name || '',
    mobile: lead.mobile || '',
    vehicle: lead.model || '',
    ...assigneeBlock(lead.assignedTo),
    leadId: String(lead._id),
    remarks: lead.remarks || '',
    href: leadHref(lead._id),
    color: colorForEvent('booking_update', 'Booking'),
  };
}

function formatDeliveryEvent(lead, dateVal) {
  const range = allDayRange(dateVal);
  if (!range) return null;
  return {
    id: `dl-${lead._id}`,
    type: 'delivery',
    title: `Delivery · ${lead.name || 'Customer'}`,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    allDay: true,
    date: isoDateOnly(range.start),
    time: null,
    status: 'Delivered',
    customerName: lead.name || '',
    mobile: lead.mobile || '',
    vehicle: lead.model || '',
    ...assigneeBlock(lead.assignedTo),
    leadId: String(lead._id),
    remarks: lead.remarks || '',
    href: leadHref(lead._id),
    color: colorForEvent('delivery', 'Delivered'),
  };
}

function formatSalesActivityEvent(source, kind) {
  if (kind === 'history') {
    const lead = source.leadId;
    const start = source.createdAt ? new Date(source.createdAt) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const leadId = lead?._id ? String(lead._id) : source.leadId ? String(source.leadId) : null;
    return {
      id: `sales-h-${source._id}`,
      type: 'sales_activity',
      title: `Assignment · ${lead?.name || 'Lead'}`,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      date: isoDateOnly(start),
      time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
      status: source.toStage || 'Assignment',
      customerName: lead?.name || '',
      mobile: lead?.mobile || '',
      vehicle: lead?.model || '',
      ...assigneeBlock(lead?.assignedTo),
      leadId,
      remarks: source.reason || '',
      href: leadHref(leadId),
      color: colorForEvent('sales_activity', 'Assignment'),
    };
  }
  const lead = source;
  const range = allDayRange(lead.lastActivityAt);
  if (!range) return null;
  return {
    id: `sales-a-${lead._id}`,
    type: 'sales_activity',
    title: `Activity · ${lead.name || 'Customer'}`,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    allDay: true,
    date: isoDateOnly(range.start),
    time: null,
    status: lead.status,
    customerName: lead.name || '',
    mobile: lead.mobile || '',
    vehicle: lead.model || '',
    ...assigneeBlock(lead.assignedTo),
    leadId: String(lead._id),
    remarks: lead.remarks || '',
    href: leadHref(lead._id),
    color: colorForEvent('sales_activity', lead.status),
  };
}

function formatAwaitingVehicleEvent(lead) {
  const dateVal = lead.updatedAt || lead.creSheet?.bookingDate || lead.createdAt;
  const range = allDayRange(dateVal);
  if (!range) return null;
  return {
    id: `av-${lead._id}`,
    type: 'awaiting_vehicle',
    title: `Awaiting vehicle · ${lead.name || 'Customer'}`,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    allDay: true,
    date: isoDateOnly(range.start),
    time: null,
    status: 'Booking',
    customerName: lead.name || '',
    mobile: lead.mobile || '',
    vehicle: lead.model || lead.creSheet?.finalModel || '',
    ...assigneeBlock(lead.assignedTo),
    leadId: String(lead._id),
    remarks: lead.remarks || lead.creSheet?.initialRemark || '',
    href: leadHref(lead._id),
    color: colorForEvent('awaiting_vehicle', 'Booking'),
  };
}

function isAwaitingVehicleLead(lead) {
  if (String(lead.status || '') !== 'Booking') return false;
  if (lead.convertedAt) return false;
  const sheet = lead.creSheet || {};
  if (sheet.retailDone === true || sheet.deliveryDate) return false;
  // Explicit waiting signals, or Booking without conversion/delivery = awaiting
  if (sheet.bookingDone === true && sheet.retailDone !== true) return true;
  if (sheet.mailSent === true && !sheet.deliveryDate) return true;
  const remarks = String(lead.remarks || sheet.initialRemark || sheet.salesPersonRemark || '').toLowerCase();
  if (/(await|waiting|awaiting).{0,20}(vehicle|stock|delivery|car)/i.test(remarks)) return true;
  return true;
}

function deliveryDateForLead(lead) {
  if (lead.convertedAt) return new Date(lead.convertedAt);
  if (lead.creSheet?.deliveryDate) return new Date(lead.creSheet.deliveryDate);
  if (lead.updatedAt) return new Date(lead.updatedAt);
  return null;
}

function dateInRange(d, start, end) {
  if (!d || Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

function applyLeadScope(query, leadScope, assigneeLeadFilter) {
  const and = Array.isArray(query.$and) ? [...query.$and] : [];
  if (leadScope) and.push(leadScope);
  if (assigneeLeadFilter) and.push(assigneeLeadFilter);
  if (and.length) query.$and = and;
  return query;
}

function leadMatchesAssignee(lead, admin, assigneeParam) {
  if (!assigneeParam || assigneeParam === 'all') return true;
  const assigned = lead?.assignedTo?._id || lead?.assignedTo;
  if (assigneeParam === 'unassigned') return !assigned;
  const target = assigneeParam === 'me' ? String(admin._id) : String(assigneeParam);
  return Boolean(assigned && String(assigned) === target);
}

async function filterHistoryByLeadScope(histories, teamScoped, admin, assigneeParam) {
  const list = histories || [];
  if (!list.length) return [];
  let allowed = null;
  if (teamScoped) allowed = new Set(await resolveStaffIdsForUser(admin));
  const email = normalizeEmail(admin.email);
  return list.filter((h) => {
    const lead = h.leadId;
    if (!lead) return false;
    if (allowed) {
      const assigned = lead.assignedTo?._id || lead.assignedTo;
      const ok =
        (assigned && allowed.has(String(assigned))) ||
        (email && normalizeEmail(lead.assignedToEmail) === email) ||
        (email && normalizeEmail(lead.assignedTo?.email) === email);
      if (!ok) return false;
    }
    return leadMatchesAssignee(lead, admin, assigneeParam);
  });
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

const LEAD_POPULATE = {
  path: 'assignedTo',
  select: 'name email designation reportsTo',
  populate: { path: 'reportsTo', select: 'name email designation' },
};

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
        'bookingId bookingStatus slotDate slotTime preferredModel customerName customerMobile assignmentStatus remarks assignedExecutive leadId',
      )
      .limit(QUERY_LIMIT)
      .lean();

    for (const b of bookings) events.push(formatTdEvent(b));
  }

  // Follow-up docs first (needed for nextFollowUp lead dedupe)
  const followUpLeadDayKeys = new Set();
  if (wantType(types, 'lead_follow_up') || wantType(types, 'follow_up')) {
    const fuQuery = { scheduledAt: { $gte: start, $lte: end } };
    if (statusFilter) fuQuery.status = statusFilter.toLowerCase();

    let followUps = await LeadFollowUp.find(fuQuery)
      .populate({
        path: 'leadId',
        select: 'name mobile model status assignedTo assignedToEmail',
        populate: { path: 'assignedTo', select: 'name email designation' },
      })
      .select('leadId scheduledAt status note')
      .limit(QUERY_LIMIT)
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
      if (ev) {
        events.push(ev);
        if (ev.leadId && ev.date) followUpLeadDayKeys.add(`${ev.leadId}:${ev.date}`);
      }
    }
  }

  // Legacy nextFollowUp lead events — skip when a LeadFollowUp exists same day
  if (wantType(types, 'lead') || wantType(types, 'lead_follow_up')) {
    const query = applyLeadScope(
      {
        status: { $nin: CLOSED_LEAD_STATUSES },
        nextFollowUp: { $gte: start, $lte: end },
      },
      leadScope,
      assigneeLeadFilter,
    );
    if (statusFilter) query.status = statusFilter;
    if (modelFilter) query.model = new RegExp(modelFilter, 'i');

    const leads = await Lead.find(query)
      .populate(LEAD_POPULATE)
      .select('name mobile model status nextFollowUp createdAt remarks assignedTo')
      .limit(QUERY_LIMIT)
      .lean();

    for (const lead of leads) {
      const day = isoDateOnly(lead.nextFollowUp);
      const key = `${lead._id}:${day}`;
      if (followUpLeadDayKeys.has(key)) continue;
      events.push(formatLeadEvent(lead));
    }
  }

  if (wantType(types, 'new_lead')) {
    const query = applyLeadScope(
      { createdAt: { $gte: start, $lte: end } },
      leadScope,
      assigneeLeadFilter,
    );
    if (statusFilter) query.status = statusFilter;
    if (modelFilter) query.model = new RegExp(modelFilter, 'i');

    const leads = await Lead.find(query)
      .populate(LEAD_POPULATE)
      .select('name mobile model status createdAt remarks assignedTo')
      .limit(QUERY_LIMIT)
      .lean();

    for (const lead of leads) {
      const ev = formatNewLeadEvent(lead);
      if (ev) events.push(ev);
    }
  }

  if (wantType(types, 'stage_activity')) {
    const histQuery = {
      createdAt: { $gte: start, $lte: end },
      reason: { $not: /Assignment/i },
    };
    let histories = await LeadStageHistory.find(histQuery)
      .populate({
        path: 'leadId',
        select: 'name mobile model status assignedTo assignedToEmail',
        populate: {
          path: 'assignedTo',
          select: 'name email designation reportsTo',
          populate: { path: 'reportsTo', select: 'name email' },
        },
      })
      .select('leadId fromStage toStage reason createdAt')
      .limit(QUERY_LIMIT)
      .lean()
      .catch(() => []);

    histories = await filterHistoryByLeadScope(histories, teamScoped, req.admin, assigneeParam);

    if (modelFilter) {
      histories = histories.filter((h) =>
        String(h.leadId?.model || '')
          .toLowerCase()
          .includes(modelFilter.toLowerCase()),
      );
    }

    for (const h of histories) {
      const ev = formatStageActivityEvent(h);
      if (ev) events.push(ev);
    }
  }

  if (wantType(types, 'booking_update')) {
    const seen = new Set();

    const bookingLeadQuery = applyLeadScope(
      {
        status: 'Booking',
        $or: [
          { convertedAt: { $gte: start, $lte: end } },
          { updatedAt: { $gte: start, $lte: end } },
        ],
      },
      leadScope,
      assigneeLeadFilter,
    );
    if (modelFilter) bookingLeadQuery.model = new RegExp(modelFilter, 'i');

    const bookingLeads = await Lead.find(bookingLeadQuery)
      .populate(LEAD_POPULATE)
      .select('name mobile model status convertedAt updatedAt remarks assignedTo')
      .limit(QUERY_LIMIT)
      .lean();

    for (const lead of bookingLeads) {
      const dateVal =
        lead.convertedAt && dateInRange(new Date(lead.convertedAt), start, end)
          ? lead.convertedAt
          : lead.updatedAt;
      const ev = formatBookingUpdateEvent(lead, dateVal);
      if (ev && !seen.has(String(lead._id))) {
        seen.add(String(lead._id));
        events.push(ev);
      }
    }

    // Stage history transitions into Booking
    let bookingHistories = await LeadStageHistory.find({
      toStage: 'Booking',
      createdAt: { $gte: start, $lte: end },
    })
      .populate({
        path: 'leadId',
        select: 'name mobile model status convertedAt updatedAt remarks assignedTo assignedToEmail',
        populate: LEAD_POPULATE,
      })
      .select('leadId createdAt toStage')
      .limit(QUERY_LIMIT)
      .lean()
      .catch(() => []);

    bookingHistories = await filterHistoryByLeadScope(bookingHistories, teamScoped, req.admin, assigneeParam);

    for (const h of bookingHistories) {
      const lead = h.leadId;
      if (!lead) continue;
      const id = String(lead._id);
      if (seen.has(id)) continue;
      if (modelFilter && !String(lead.model || '').toLowerCase().includes(modelFilter.toLowerCase())) continue;
      const ev = formatBookingUpdateEvent(lead, h.createdAt || lead.updatedAt);
      if (ev) {
        seen.add(id);
        events.push(ev);
      }
    }
  }

  if (wantType(types, 'delivery')) {
    const query = applyLeadScope({ status: 'Delivered' }, leadScope, assigneeLeadFilter);
    if (modelFilter) query.model = new RegExp(modelFilter, 'i');

    const leads = await Lead.find(query)
      .populate(LEAD_POPULATE)
      .select('name mobile model status convertedAt updatedAt remarks assignedTo creSheet')
      .limit(QUERY_LIMIT)
      .lean();

    for (const lead of leads) {
      const d = deliveryDateForLead(lead);
      if (!dateInRange(d, start, end)) continue;
      const ev = formatDeliveryEvent(lead, d);
      if (ev) events.push(ev);
    }
  }

  if (wantType(types, 'sales_activity')) {
    const assignmentLeadIds = new Set();

    let assignmentHistories = await LeadStageHistory.find({
      createdAt: { $gte: start, $lte: end },
      reason: /Assignment/i,
    })
      .populate({
        path: 'leadId',
        select: 'name mobile model status assignedTo assignedToEmail remarks',
        populate: LEAD_POPULATE,
      })
      .select('leadId fromStage toStage reason createdAt')
      .limit(QUERY_LIMIT)
      .lean()
      .catch(() => []);

    assignmentHistories = await filterHistoryByLeadScope(
      assignmentHistories,
      teamScoped,
      req.admin,
      assigneeParam,
    );

    for (const h of assignmentHistories) {
      if (modelFilter && !String(h.leadId?.model || '').toLowerCase().includes(modelFilter.toLowerCase())) {
        continue;
      }
      const ev = formatSalesActivityEvent(h, 'history');
      if (ev) {
        events.push(ev);
        if (ev.leadId) assignmentLeadIds.add(ev.leadId);
      }
    }

    // Fallback: lastActivityAt in range for leads without assignment history that day
    const activityQuery = applyLeadScope(
      { lastActivityAt: { $gte: start, $lte: end } },
      leadScope,
      assigneeLeadFilter,
    );
    if (statusFilter) activityQuery.status = statusFilter;
    if (modelFilter) activityQuery.model = new RegExp(modelFilter, 'i');

    const activityLeads = await Lead.find(activityQuery)
      .populate(LEAD_POPULATE)
      .select('name mobile model status lastActivityAt remarks assignedTo')
      .limit(QUERY_LIMIT)
      .lean();

    for (const lead of activityLeads) {
      if (assignmentLeadIds.has(String(lead._id))) continue;
      const ev = formatSalesActivityEvent(lead, 'activity');
      if (ev) events.push(ev);
    }
  }

  if (wantType(types, 'awaiting_vehicle')) {
    const query = applyLeadScope(
      {
        status: 'Booking',
        $and: [
          { $or: [{ convertedAt: null }, { convertedAt: { $exists: false } }] },
          {
            $or: [
              { updatedAt: { $gte: start, $lte: end } },
              { 'creSheet.bookingDate': { $gte: start, $lte: end } },
              { createdAt: { $gte: start, $lte: end } },
            ],
          },
        ],
      },
      leadScope,
      assigneeLeadFilter,
    );
    if (modelFilter) query.model = new RegExp(modelFilter, 'i');

    const leads = await Lead.find(query)
      .populate(LEAD_POPULATE)
      .select('name mobile model status convertedAt updatedAt createdAt remarks assignedTo creSheet')
      .limit(QUERY_LIMIT)
      .lean();

    for (const lead of leads) {
      if (!isAwaitingVehicleLead(lead)) continue;
      const ev = formatAwaitingVehicleEvent(lead);
      if (ev && dateInRange(new Date(ev.start), start, end)) events.push(ev);
    }
  }

  if (wantType(types, 'pending_approval')) {
    const apQuery = {
      approvalStatus: 'PENDING',
      createdAt: { $gte: start, $lte: end },
    };
    if (tdScope) apQuery.$and = [tdScope];

    const approvals = await TDBooking.find(apQuery)
      .select('bookingId customerName createdAt assignedExecutive')
      .limit(QUERY_LIMIT)
      .lean();
    for (const b of approvals) {
      events.push({
        id: `ap-${b._id}`,
        type: 'pending_approval',
        title: `Approval · ${b.bookingId || b.customerName || 'TD'}`,
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

  if (wantType(types, 'customer_appointment') || wantType(types, 'reschedule')) {
    const rsQuery = {
      status: 'PENDING',
      createdAt: { $gte: start, $lte: end },
    };
    const reschedules = await TDRescheduleRequest.find(rsQuery)
      .select('bookingCode createdAt requestedByName bookingId')
      .limit(QUERY_LIMIT)
      .lean();

    let filtered = reschedules || [];
    if (teamScoped && filtered.length) {
      // Soft team filter: keep requests whose booking is in team scope when we can resolve it
      const codes = filtered.map((r) => r.bookingCode).filter(Boolean);
      const bookingIds = filtered.map((r) => r.bookingId).filter(Boolean);
      const tdQuery = { $or: [] };
      if (codes.length) tdQuery.$or.push({ bookingId: { $in: codes } });
      if (bookingIds.length) tdQuery.$or.push({ _id: { $in: bookingIds } });
      if (tdQuery.$or.length && tdScope) {
        tdQuery.$and = [tdScope];
        const scopedBookings = await TDBooking.find(tdQuery).select('_id bookingId').lean();
        const allowedCodes = new Set(scopedBookings.map((b) => b.bookingId).filter(Boolean));
        const allowedIds = new Set(scopedBookings.map((b) => String(b._id)));
        filtered = filtered.filter(
          (r) =>
            (r.bookingCode && allowedCodes.has(r.bookingCode)) ||
            (r.bookingId && allowedIds.has(String(r.bookingId))),
        );
      }
    }

    for (const r of filtered) {
      events.push({
        id: `rs-${r._id}`,
        type: 'customer_appointment',
        title: `Reschedule · ${r.bookingCode || 'TD'}`,
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
