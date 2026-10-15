const TDStaff = require('../models/TDStaff');
const { applyBookingExecutiveAssignment, normalizeEmail } = require('./leadAssignment');

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
async function assignNewBookingToTdCoordinator(booking, { notify = false, actorId, save = true } = {}) {
  if (!booking) return null;

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

module.exports = {
  tdCoordinatorEmail,
  findTdCoordinatorStaff,
  assignNewBookingToTdCoordinator,
};
