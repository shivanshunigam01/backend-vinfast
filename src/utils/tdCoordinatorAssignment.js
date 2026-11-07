const TDStaff = require('../models/TDStaff');
const TDBooking = require('../models/TDBooking');
const { applyBookingExecutiveAssignment, normalizeEmail } = require('./leadAssignment');

/** Open test drives that still need an executive / coordinator. */
const OPEN_TD_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS'];

const DEFAULT_TD_COORDINATOR_EMAIL = 'tdcoordinator@patliputravinfast.com';

function tdCoordinatorEmail() {
  return normalizeEmail(process.env.TD_COORDINATOR_EMAIL || DEFAULT_TD_COORDINATOR_EMAIL);
}

/** CRM pipeline stages the TD coordinator must see in Lead CRM (all assignees). */
const CRM_TD_BOOKED_STATUSES = ['Test Drive Booked', 'Test Drive Scheduled'];

function isCrmLeadTdBookedForCoordinator(lead) {
  const plain = lead?.toObject ? lead.toObject() : lead;
  if (!plain) return false;
  const { normalizeStageLabel } = require('../constants/leadStages');
  if (normalizeStageLabel(plain.status) === 'Test Drive Booked') return true;
  if (plain.tdBookingId) return true;
  return false;
}

/** Mongo filter: leads in “test drive booked” pipeline (any sales owner). */
function crmTdBookedLeadsMongoFilter() {
  return {
    $or: [
      { status: { $in: CRM_TD_BOOKED_STATUSES } },
      { tdBookingId: { $exists: true, $ne: null } },
    ],
  };
}

function isTdCoordinatorDesignation(designation) {
  const d = String(designation || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return d.includes('td_coordinator') || d.includes('test_drive_coordinator');
}

/** TDStaff row is the dealership TD coordinator (User Master). */
function isTdCoordinatorStaff(staff) {
  if (!staff) return false;
  const target = tdCoordinatorEmail();
  if (target && normalizeEmail(staff.email) === target) return true;
  return isTdCoordinatorDesignation(staff.designation);
}

/** Logged-in user is the TD coordinator (full staff list for TD assignment). */
function isTdCoordinatorUser(admin) {
  if (!admin) return false;
  const target = tdCoordinatorEmail();
  if (target && normalizeEmail(admin.email) === target) return true;
  if (isTdCoordinatorDesignation(admin.designation)) return true;
  const name = String(admin?.name || '').toLowerCase().trim();
  if (name === 'td coordinator' || name.includes('test drive coordinator')) return true;
  return false;
}

/** Session check including duplicate User Master rows (async). */
async function resolveTdCoordinatorSession(admin) {
  if (isTdCoordinatorUser(admin)) return true;
  const { resolveSelfStaffIds } = require('./leadAssignment');
  const selfIds = await resolveSelfStaffIds(admin);
  const { ids } = await collectCoordinatorStaffIds();
  if (selfIds.some((id) => ids.includes(id))) return true;
  return false;
}

/** Every User Master row that represents the TD coordinator (duplicate-safe). */
async function collectCoordinatorStaffIds() {
  const ids = new Set();
  const emails = new Set();

  const primary = await findTdCoordinatorStaff();
  if (primary?._id) ids.add(String(primary._id));
  if (primary?.email) emails.add(normalizeEmail(primary.email));

  const target = tdCoordinatorEmail();
  if (target) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const byEmail = await TDStaff.find({
      email: new RegExp(`^${escaped}$`, 'i'),
      active: { $ne: false },
    })
      .select('_id email')
      .lean();
    for (const row of byEmail) {
      ids.add(String(row._id));
      if (row.email) emails.add(normalizeEmail(row.email));
    }
  }

  const byDesignation = await TDStaff.find({
    active: { $ne: false },
    designation: { $regex: /(td_coordinator|test_drive_coordinator)/i },
  })
    .select('_id email')
    .lean();
  for (const row of byDesignation) {
    ids.add(String(row._id));
    if (row.email) emails.add(normalizeEmail(row.email));
  }

  return { ids: [...ids], emails: [...emails] };
}

/** Lead CRM list for TD coordinator: all TD-booked pipeline + leads assigned to any coordinator row. */
async function coordinatorCrmLeadsVisibilityFilter(admin) {
  const { assignedToIdsFilter } = require('./leadAssignment');
  const { ids, emails } = await collectCoordinatorStaffIds();
  const viewerEmail = normalizeEmail(admin?.email);
  const emailList = [...new Set([...emails, ...(viewerEmail ? [viewerEmail] : [])])];
  const assigned = assignedToIdsFilter(ids, viewerEmail, emailList);
  return { $or: [crmTdBookedLeadsMongoFilter(), assigned] };
}

let cachedCoordinator = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function findTdCoordinatorStaff() {
  const email = tdCoordinatorEmail();
  const now = Date.now();
  if (
    cachedCoordinator &&
    cacheExpiresAt > now &&
    (!email || normalizeEmail(cachedCoordinator.email) === email)
  ) {
    return cachedCoordinator;
  }

  let staff = null;
  if (email) {
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    staff = await TDStaff.findOne({
      email: new RegExp(`^${escaped}$`, 'i'),
      active: { $ne: false },
    }).select('name email role designation');
  }
  if (!staff) {
    staff = await TDStaff.findOne({
      active: { $ne: false },
      designation: { $regex: /(td_coordinator|test_drive_coordinator)/i },
    })
      .sort({ createdAt: 1 })
      .select('name email role designation');
  }
  if (staff) {
    cachedCoordinator = staff;
    cacheExpiresAt = now + CACHE_TTL_MS;
  } else {
    cachedCoordinator = null;
    cacheExpiresAt = 0;
    console.warn(
      `[tdCoordinator] No active coordinator (set TD_COORDINATOR_EMAIL or td_coordinator in User Master)`,
    );
  }
  return staff;
}

/**
 * Intake test drives (website or Lead CRM) land on the TD coordinator first;
 * they assign the sales executive, demo car, and DL from TD bookings.
 */
function isTdBookingUnassigned(booking) {
  if (!booking) return false;
  const exec = booking.assignedExecutive?._id || booking.assignedExecutive;
  if (exec) return false;
  if (booking.assignedExecutiveEmail) return false;
  return true;
}

async function assignNewBookingToTdCoordinator(
  booking,
  { notify = false, actorId, save = true, queueForCoordinator = false } = {},
) {
  if (!booking) return null;
  if (!isTdBookingUnassigned(booking)) return booking;

  const coordinator = await findTdCoordinatorStaff();
  if (!coordinator) {
    console.warn(`[tdCoordinator] No active TDStaff user for ${tdCoordinatorEmail()}`);
    return booking;
  }

  applyBookingExecutiveAssignment(booking, coordinator);
  booking.assignmentStatus = 'ACCEPTED';
  booking.assignmentRespondedAt = new Date();
  booking.assignmentRejectReason = undefined;
  if (
    queueForCoordinator &&
    !['COMPLETED', 'CANCELLED'].includes(String(booking.bookingStatus || '').toUpperCase())
  ) {
    booking.bookingStatus = 'PENDING';
  }

  if (save) {
    await booking.save();
  }

  if (notify) {
    try {
      const { notifyTdEvent } = require('./staffNotifications');
      await notifyTdEvent(booking, {
        type: 'td_booked',
        title: 'New test drive — assign executive',
        actorId,
        priority: 'today',
      });
    } catch (err) {
      console.error('[assignNewBookingToTdCoordinator notify]', err.message);
    }
  }

  return booking;
}

/**
 * Website + Lead CRM intake: clear any prior executive and queue on the TD coordinator
 * (demo car, slot confirm, delegate to SE) — same as public test-drive sync.
 */
async function routeIntakeBookingToTdCoordinator(booking, { actorId, notify = true, save = true } = {}) {
  if (!booking) return null;
  const coordinator = await findTdCoordinatorStaff();
  if (!coordinator) {
    console.warn(
      '[tdCoordinator] Booking not routed — configure TD_COORDINATOR_EMAIL or td_coordinator in User Master',
    );
    return booking;
  }

  applyBookingExecutiveAssignment(booking, coordinator);
  booking.assignmentStatus = 'ACCEPTED';
  booking.assignmentRespondedAt = new Date();
  booking.assignmentRejectReason = undefined;

  if (save) {
    await booking.save();
  }

  if (notify) {
    try {
      const { notifyTdEvent } = require('./staffNotifications');
      await notifyTdEvent(booking, {
        type: 'td_booked',
        title: 'New test drive — assign executive',
        actorId,
        priority: 'today',
      });
    } catch (err) {
      console.error('[routeIntakeBookingToTdCoordinator notify]', err.message);
    }
  }

  return booking;
}

/**
 * Backfill: any open test drive without an assigned executive goes to the TD coordinator.
 */
async function repairUnassignedActiveTestDriveBookings({ limit = 100, notify = false } = {}) {
  const coordinator = await findTdCoordinatorStaff();
  if (!coordinator) return { repaired: 0, skipped: true };

  const docs = await TDBooking.find({
    bookingStatus: { $in: OPEN_TD_BOOKING_STATUSES },
    $or: [{ assignedExecutive: { $exists: false } }, { assignedExecutive: null }],
    $and: [
      {
        $or: [
          { assignedExecutiveEmail: { $exists: false } },
          { assignedExecutiveEmail: null },
          { assignedExecutiveEmail: '' },
        ],
      },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 500));

  let repaired = 0;
  for (const doc of docs) {
    if (!isTdBookingUnassigned(doc)) continue;
    await assignNewBookingToTdCoordinator(doc, { notify, save: true });
    repaired += 1;
  }
  return { repaired, skipped: false };
}

let repairInFlight = false;
let lastRepairAt = 0;
const REPAIR_COOLDOWN_MS = 60 * 1000;

/** My Test Drives / TD desk: bookings on coordinator + CRM-linked open intake. */
async function tdCoordinatorMyBookingsFilter(admin) {
  const { assignedExecutiveIdsFilter, resolveSelfStaffIds } = require('./leadAssignment');
  const { ids, emails } = await collectCoordinatorStaffIds();
  const selfIds = await resolveSelfStaffIds(admin);
  const allIds = [...new Set([...ids, ...selfIds])];
  const viewerEmail = normalizeEmail(admin?.email);
  const target = tdCoordinatorEmail();
  const emailList = [
    ...new Set([
      ...emails,
      ...(target ? [target] : []),
      ...(viewerEmail ? [viewerEmail] : []),
    ]),
  ].filter(Boolean);
  const selfFilter = assignedExecutiveIdsFilter(allIds, viewerEmail, emailList);
  /** Any CRM-originated test drive (Book Test Drive on a lead) — coordinator owns slot & demo car. */
  const crmLinkedFilter = {
    leadId: { $exists: true, $ne: null },
    bookingStatus: { $nin: ['CANCELLED'] },
  };
  return { $or: [selfFilter, crmLinkedFilter] };
}

/**
 * CRM "Book test drive" intake should sit on the coordinator until they delegate.
 * Re-queue open bookings that still have leadId but wrong/missing executive.
 */
async function repairCrmIntakeBookingsToCoordinator({ limit = 150 } = {}) {
  const { ids, emails } = await collectCoordinatorStaffIds();
  if (!ids.length) return { repaired: 0 };

  const docs = await TDBooking.find({
    leadId: { $exists: true, $ne: null },
    bookingStatus: { $nin: ['CANCELLED'] },
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 500));

  let repaired = 0;
  for (const doc of docs) {
    const exec = String(doc.assignedExecutive?._id || doc.assignedExecutive || '');
    const em = normalizeEmail(doc.assignedExecutiveEmail);
    if (exec && ids.includes(exec)) continue;
    if (em && emails.includes(em)) continue;
    await routeIntakeBookingToTdCoordinator(doc, { notify: false, save: true });
    repaired += 1;
  }
  return { repaired };
}

/**
 * Leads manually assigned to TD Coordinator in CRM — ensure the linked booking matches the desk.
 */
async function repairLeadsAssignedToCoordinatorBookings({ limit = 120 } = {}) {
  const Lead = require('../models/Lead');
  const { assignedToIdsFilter } = require('./leadAssignment');
  const { ids, emails } = await collectCoordinatorStaffIds();
  if (!ids.length && !emails.length) return { repaired: 0 };

  const leadQuery = {
    $and: [
      assignedToIdsFilter(ids, null, emails),
      {
        $or: [
          { tdBookingId: { $exists: true, $ne: null } },
          { status: { $in: CRM_TD_BOOKED_STATUSES } },
        ],
      },
    ],
  };

  const leads = await Lead.find(leadQuery)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 300))
    .select('_id tdBookingId status')
    .lean();

  let repaired = 0;
  for (const lead of leads) {
    let booking = lead.tdBookingId ? await TDBooking.findById(lead.tdBookingId) : null;
    if (!booking) {
      booking = await TDBooking.findOne({ leadId: lead._id }).sort({ createdAt: -1 });
      if (booking) {
        await Lead.updateOne({ _id: lead._id }, { $set: { tdBookingId: booking._id } });
      }
    }
    if (!booking) continue;

    const exec = String(booking.assignedExecutive?._id || booking.assignedExecutive || '');
    const em = normalizeEmail(booking.assignedExecutiveEmail);
    if (exec && ids.includes(exec)) continue;
    if (em && emails.includes(em)) continue;

    await routeIntakeBookingToTdCoordinator(booking, { notify: false, save: true });
    repaired += 1;
  }
  return { repaired };
}

/**
 * Lead CRM “Book Test Drive” — always queue on TD coordinator (any staff account).
 */
async function ensureCrmLeadTestDriveRoutedToCoordinator(booking, { lead, actorId, notify = true } = {}) {
  if (!booking) return null;
  const updated = await routeIntakeBookingToTdCoordinator(booking, { actorId, notify, save: true });
  if (lead && !lead.tdBookingId) {
    const Lead = require('../models/Lead');
    await Lead.updateOne({ _id: lead._id }, { $set: { tdBookingId: booking._id } });
  }
  return updated;
}

/** When CRM assigns a TD-booked lead to the coordinator, sync the linked TDBooking row. */
async function syncTdBookingForCoordinatorLeadAssignment(lead, assignee, { actorId, notify = true } = {}) {
  if (!assignee || !isTdCoordinatorStaff(assignee)) return null;
  const plain = lead?.toObject ? lead.toObject() : lead;
  if (!plain?._id) return null;

  let booking = plain.tdBookingId ? await TDBooking.findById(plain.tdBookingId) : null;
  if (!booking) {
    booking = await TDBooking.findOne({ leadId: plain._id }).sort({ createdAt: -1 });
    if (booking) {
      const Lead = require('../models/Lead');
      await Lead.updateOne({ _id: plain._id }, { $set: { tdBookingId: booking._id } });
    }
  }
  if (!booking) return null;
  return routeIntakeBookingToTdCoordinator(booking, { notify, actorId, save: true });
}

/** Non-blocking repair (e.g. when staff open TD bookings). */
function scheduleRepairUnassignedTestDriveBookings(options = {}) {
  const now = Date.now();
  if (repairInFlight || now - lastRepairAt < REPAIR_COOLDOWN_MS) return;
  repairInFlight = true;
  setImmediate(async () => {
    try {
      lastRepairAt = Date.now();
      const result = await repairUnassignedActiveTestDriveBookings({
        limit: options.limit ?? 50,
        notify: options.notify ?? true,
      });
      if (result.repaired > 0) {
        console.log(`[tdCoordinator] Auto-assigned ${result.repaired} unassigned test drive(s)`);
      }
    } catch (err) {
      console.error('[tdCoordinator repair]', err.message);
    } finally {
      repairInFlight = false;
    }
  });
}

module.exports = {
  tdCoordinatorEmail,
  isTdCoordinatorUser,
  resolveTdCoordinatorSession,
  isTdCoordinatorStaff,
  isTdCoordinatorDesignation,
  collectCoordinatorStaffIds,
  coordinatorCrmLeadsVisibilityFilter,
  syncTdBookingForCoordinatorLeadAssignment,
  ensureCrmLeadTestDriveRoutedToCoordinator,
  CRM_TD_BOOKED_STATUSES,
  isCrmLeadTdBookedForCoordinator,
  crmTdBookedLeadsMongoFilter,
  findTdCoordinatorStaff,
  isTdBookingUnassigned,
  assignNewBookingToTdCoordinator,
  routeIntakeBookingToTdCoordinator,
  tdCoordinatorMyBookingsFilter,
  repairCrmIntakeBookingsToCoordinator,
  repairLeadsAssignedToCoordinatorBookings,
  repairUnassignedActiveTestDriveBookings,
  scheduleRepairUnassignedTestDriveBookings,
  OPEN_TD_BOOKING_STATUSES,
};
