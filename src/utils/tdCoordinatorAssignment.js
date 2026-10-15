const TDStaff = require('../models/TDStaff');
const TDBooking = require('../models/TDBooking');
const { applyBookingExecutiveAssignment, normalizeEmail } = require('./leadAssignment');

/** Open test drives that still need an executive / coordinator. */
const OPEN_TD_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS'];

const DEFAULT_TD_COORDINATOR_EMAIL = 'tdcoordinator@patliputravinfast.com';

function tdCoordinatorEmail() {
  return normalizeEmail(process.env.TD_COORDINATOR_EMAIL || DEFAULT_TD_COORDINATOR_EMAIL);
}

let cachedCoordinator = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function findTdCoordinatorStaff() {
  const email = tdCoordinatorEmail();
  if (!email) return null;

  const now = Date.now();
  if (cachedCoordinator && cacheExpiresAt > now && normalizeEmail(cachedCoordinator.email) === email) {
    return cachedCoordinator;
  }

  const staff = await TDStaff.findOne({ email, active: true }).select('name email role designation');
  if (staff) {
    cachedCoordinator = staff;
    cacheExpiresAt = now + CACHE_TTL_MS;
  } else {
    cachedCoordinator = null;
    cacheExpiresAt = 0;
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

async function assignNewBookingToTdCoordinator(booking, { notify = false, actorId, save = true } = {}) {
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
  findTdCoordinatorStaff,
  isTdBookingUnassigned,
  assignNewBookingToTdCoordinator,
  repairUnassignedActiveTestDriveBookings,
  scheduleRepairUnassignedTestDriveBookings,
  OPEN_TD_BOOKING_STATUSES,
};
