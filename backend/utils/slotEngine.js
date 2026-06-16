const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const DemoVehicle = require('../models/DemoVehicle');
const Branch = require('../models/Branch');
const { normalizeTimeTo24h, calendarDateBounds, localTodayDateStr, toCalendarDateStr } = require('./timeFormat');
const { resolveConfiguredSlotTimes, toMinutes } = require('./slotSchedule');

function normalizeVariant(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function bookingVariant(booking) {
  return booking.preferredVariant || booking.testDriveId?.variant || '';
}

function matchesVariantFilter(booking, variant) {
  if (!variant) return true;
  const bookingVar = bookingVariant(booking);
  if (!bookingVar) return false;
  return normalizeVariant(bookingVar) === normalizeVariant(variant);
}

function getAdminDisabledTimes(config, dateStr) {
  const raw = config?.disabledSlotsByDate;
  if (!raw || !dateStr) return [];
  if (raw instanceof Map) return raw.get(dateStr) || [];
  if (typeof raw === 'object') return raw[dateStr] || [];
  return [];
}

/** Vehicles physically ready right now (for live vehicle picker). */
async function countAvailableFleet(branchId, model, variant = null) {
  const now = new Date();
  const query = {
    active: true,
    branchId,
    status: 'AVAILABLE',
    $or: [{ isLocked: false }, { lockExpiresAt: { $lt: now } }]
  };
  if (model) query.model = model;

  const vehicles = await DemoVehicle.find(query).select('variant');
  if (!variant) return vehicles.length;
  return vehicles.filter((v) => normalizeVariant(v.variant) === normalizeVariant(variant)).length;
}

/**
 * Demo cars that can serve test drives on a given date (per model / trim).
 * Uses fleet size — not today's RUNNING/BOOKED status — so future dates stay bookable.
 */
async function countFleetCapacity(branchId, model, dateInput, variant = null) {
  const query = { active: true, branchId };
  if (model) query.model = model;

  const vehicles = await DemoVehicle.find(query).select('status availableAgainAt variant');
  if (!vehicles.length) return 0;

  const bounds = calendarDateBounds(dateInput);
  const endOfDay = bounds?.endOfDay;

  let count = 0;
  for (const v of vehicles) {
    if (variant && normalizeVariant(v.variant) !== normalizeVariant(variant)) continue;
    if (endOfDay && v.availableAgainAt && new Date(v.availableAgainAt) > endOfDay) {
      continue;
    }
    count += 1;
  }
  return count;
}

async function buildSlotOccupancy(branchId, dateInput, branchName, model, variant = null) {
  const bounds = calendarDateBounds(dateInput);
  if (!bounds) return {};
  const { startOfDay, endOfDay } = bounds;
  const occupancy = {};

  const tdQuery = {
    branchId,
    slotDate: { $gte: startOfDay, $lte: endOfDay },
    bookingStatus: { $nin: ['CANCELLED', 'MISSED'] }
  };
  if (model) tdQuery.preferredModel = model;

  const tdBookings = await TDBooking.find(tdQuery)
    .populate('testDriveId', 'variant model')
    .select('slotTime preferredModel preferredVariant testDriveId');

  for (const b of tdBookings) {
    if (!matchesVariantFilter(b, variant)) continue;
    const key = normalizeTimeTo24h(b.slotTime) || b.slotTime;
    occupancy[key] = (occupancy[key] || 0) + 1;
  }

  const testDriveQuery = {
    preferredDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['Cancelled'] },
    tdBookingId: { $exists: false }
  };
  if (branchName) testDriveQuery.branch = branchName;
  if (model) testDriveQuery.model = model;

  const testDrives = await TestDrive.find(testDriveQuery).select('preferredTime model variant');
  for (const td of testDrives) {
    if (variant && normalizeVariant(td.variant) !== normalizeVariant(variant)) continue;
    const key = normalizeTimeTo24h(td.preferredTime) || td.preferredTime;
    occupancy[key] = (occupancy[key] || 0) + 1;
  }

  return occupancy;
}

/** Per-slot limit = demo fleet count for the model/trim (physical capacity). */
function resolveEffectiveMax(_maxConcurrentBookings, fleetCapacity) {
  if (!fleetCapacity || fleetCapacity <= 0) return 0;
  return fleetCapacity;
}

/**
 * Returns admin-configured slot times with live availability (bookings + fleet per model).
 */
async function getAvailableSlots(branchId, dateInput, config, options = {}) {
  const { maxConcurrentBookings = 1 } = config;
  const { model, variant, excludePastForToday = true } = options;

  const bounds = calendarDateBounds(dateInput);
  if (!bounds) return [];
  const { dateStr } = bounds;

  const branch = await Branch.findById(branchId).select('name');
  const branchName = branch?.name;

  const fleetCapacity = await countFleetCapacity(branchId, model, dateStr, variant || null);
  const effectiveMax = resolveEffectiveMax(maxConcurrentBookings, fleetCapacity);

  const slotOccupancy = await buildSlotOccupancy(branchId, dateStr, branchName, model, variant || null);
  const timeKeys = resolveConfiguredSlotTimes(config);

  const now = new Date();
  const todayStr = localTodayDateStr();
  const isToday = dateStr === todayStr;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const forceOff = Boolean(options.forceUnavailable);

  const adminDisabled = getAdminDisabledTimes(config, dateStr);

  return timeKeys.map((timeKey) => {
    const booked = slotOccupancy[timeKey] || 0;
    const minute = toMinutes(timeKey);
    const pastSlot = isToday && excludePastForToday && minute <= nowMinutes;
    const adminOff = adminDisabled.includes(timeKey);
    const capacityFull = effectiveMax > 0 && booked >= effectiveMax;

    return {
      time: timeKey,
      available: !forceOff && !pastSlot && !adminOff && effectiveMax > 0 && !capacityFull,
      bookings: booked,
      maxBookings: effectiveMax,
      fleetCapacity,
      fleetAvailable: fleetCapacity,
      past: pastSlot,
      bookable: true,
      reason: forceOff
        ? (options.unavailableReason || 'blocked')
        : adminOff
          ? 'blocked'
          : pastSlot
            ? 'past'
            : fleetCapacity === 0
              ? 'no_fleet'
              : capacityFull
                ? 'full'
                : null
    };
  });
}

async function isSlotAvailable(branchId, slotDate, slotTime, maxConcurrentBookings = 1, excludeBookingId = null, model = null, variant = null) {
  const bounds = calendarDateBounds(slotDate);
  if (!bounds) return false;
  const { dateStr } = bounds;
  const normalizedTime = normalizeTimeTo24h(slotTime);
  if (!normalizedTime) return false;

  const fleetCapacity = await countFleetCapacity(branchId, model, dateStr, variant);
  const effectiveMax = resolveEffectiveMax(maxConcurrentBookings, fleetCapacity);
  if (effectiveMax === 0) return false;

  const branch = await Branch.findById(branchId).select('name');
  const occupancy = await buildSlotOccupancy(branchId, dateStr, branch?.name, model, variant);
  let count = occupancy[normalizedTime] || 0;

  if (excludeBookingId) {
    const excluded = await TDBooking.findById(excludeBookingId)
      .populate('testDriveId', 'variant')
      .select('slotTime preferredModel preferredVariant testDriveId');
    if (excluded) {
      const exKey = normalizeTimeTo24h(excluded.slotTime) || excluded.slotTime;
      const sameModel = !model || excluded.preferredModel === model;
      const sameVariant = !variant || matchesVariantFilter(excluded, variant);
      if (exKey === normalizedTime && sameModel && sameVariant) {
        count = Math.max(0, count - 1);
      }
    }
  }

  return count < effectiveMax;
}

async function assertSlotBookable({ branchId, slotDate, slotTime, model, variant, config }) {
  const dateStr = toCalendarDateStr(slotDate);
  if (!dateStr) {
    const err = new Error('Invalid preferred date');
    err.statusCode = 400;
    throw err;
  }
  const normalizedTime = normalizeTimeTo24h(slotTime);
  if (!normalizedTime) {
    const err = new Error('Invalid preferred time format');
    err.statusCode = 400;
    throw err;
  }

  if (config?.blockedDates?.includes(dateStr)) {
    const err = new Error('This date is not available for test drives');
    err.statusCode = 400;
    throw err;
  }

  const allowedTimes = resolveConfiguredSlotTimes(config);
  if (!allowedTimes.includes(normalizedTime)) {
    const err = new Error('This time is not offered for test drives. Please choose a listed slot.');
    err.statusCode = 400;
    throw err;
  }

  const slots = await getAvailableSlots(branchId, dateStr, config, { model, variant });
  const slot = slots.find((s) => s.time === normalizedTime);
  if (!slot?.available) {
    const label = variant ? `${model || 'vehicle'} ${variant}` : model || 'vehicle';
    const msg =
      slot?.reason === 'no_fleet'
        ? `No demo ${label} is available at the showroom for this date. Please pick another date or trim.`
        : slot?.reason === 'full'
          ? `This time slot is fully booked for ${label}. Please choose another slot or trim.`
          : slot?.reason === 'past'
            ? 'This time slot has already passed. Please choose a later slot.'
            : 'This time slot is not available. Please choose another slot.';
    const err = new Error(msg);
    err.statusCode = 409;
    throw err;
  }

  return normalizedTime;
}

module.exports = {
  getAvailableSlots,
  isSlotAvailable,
  assertSlotBookable,
  countAvailableFleet,
  countFleetCapacity,
  getAdminDisabledTimes
};
