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

/** Logged-in user is the TD coordinator (full staff list for TD assignment). */
function isTdCoordinatorUser(admin) {
  if (!admin) return false;
  const target = tdCoordinatorEmail();
  if (target && normalizeEmail(admin.email) === target) return true;
  const d = String(admin.designation || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return d.includes('td_coordinator') || d.includes('test_drive_coordinator');
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
    staff = await TDStaff.findOne({ email, active: { $ne: false } }).select('name email role designation');
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
  applyBookingExecutiveAssignment(booking, null);
  booking.assignmentStatus = 'UNASSIGNED';
  booking.assignmentRespondedAt = undefined;
  booking.assignmentRejectReason = undefined;

  const updated = await assignNewBookingToTdCoordinator(booking, { notify, actorId, save });
  const exec = updated?.assignedExecutive?._id || updated?.assignedExecutive;
  if (!exec && !updated?.assignedExecutiveEmail) {
    console.warn(
      '[tdCoordinator] Booking saved without coordinator — configure TD_COORDINATOR_EMAIL or td_coordinator in User Master',
    );
  }
  return updated;
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

/** My Test Drives: coordinator sees own assignments + entire open pipeline. */
async function tdCoordinatorMyBookingsFilter(admin) {
  const { assignedExecutiveFilterAsync } = require('./leadAssignment');
  const selfFilter = await assignedExecutiveFilterAsync(admin);
  return {
    $or: [selfFilter, { bookingStatus: { $in: OPEN_TD_BOOKING_STATUSES } }],
  };
}

/**
 * CRM "Book test drive" intake should sit on the coordinator until they delegate.
 * Re-queue open bookings that still have leadId but wrong/missing executive.
 */
async function repairCrmIntakeBookingsToCoordinator({ limit = 150 } = {}) {
  const coordinator = await findTdCoordinatorStaff();
  if (!coordinator) return { repaired: 0 };

  const coordOid = coordinator._id;
  const coordEmail = normalizeEmail(coordinator.email);
  const docs = await TDBooking.find({
    bookingStatus: { $in: OPEN_TD_BOOKING_STATUSES },
    leadId: { $exists: true, $ne: null },
    assignedExecutive: { $ne: coordOid },
    ...(coordEmail
      ? {
          assignedExecutiveEmail: { $ne: coordEmail },
        }
      : {}),
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 500));

  let repaired = 0;
  for (const doc of docs) {
    const exec = doc.assignedExecutive?._id || doc.assignedExecutive;
    if (exec && String(exec) === String(coordOid)) continue;
    if (
      doc.assignedExecutiveEmail &&
      normalizeEmail(doc.assignedExecutiveEmail) === normalizeEmail(coordinator.email)
    ) {
      continue;
    }
    await routeIntakeBookingToTdCoordinator(doc, { notify: false, save: true });
    repaired += 1;
  }
  return { repaired };
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
  CRM_TD_BOOKED_STATUSES,
  isCrmLeadTdBookedForCoordinator,
  crmTdBookedLeadsMongoFilter,
  findTdCoordinatorStaff,
  isTdBookingUnassigned,
  assignNewBookingToTdCoordinator,
  routeIntakeBookingToTdCoordinator,
  tdCoordinatorMyBookingsFilter,
  repairCrmIntakeBookingsToCoordinator,
  repairUnassignedActiveTestDriveBookings,
  scheduleRepairUnassignedTestDriveBookings,
  OPEN_TD_BOOKING_STATUSES,
};
