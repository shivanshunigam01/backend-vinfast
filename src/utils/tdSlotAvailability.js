const TDBooking = require('../models/TDBooking');
const TDVehicle = require('../models/TDVehicle');
const TDSlotConfig = require('../models/TDSlotConfig');
const ApiError = require('./apiError');
const {
  generateSlotTimesFromRules,
  normalizeSlotTimesList,
  isoDateOnly,
  isSlotPast,
  formatTime12h,
} = require('./tdSlotUtils');
const { branchFleetQuery, normalizeModel } = require('./tdVehicleLegacyImport');

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'];

function normalizeVariant(value) {
  return String(value || '').trim().toLowerCase();
}

function calendarDayBounds(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end, endOfDay, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

function normalizeSlotTimeKey(raw) {
  const s = String(raw || '').trim();
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2];
    const mer = m12[3].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (m24) return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
  return s;
}

function bookingMatchesVariant(booking, variant) {
  if (!variant) return true;
  const bookingVariant =
    booking.preferredVariant ||
    booking.testDriveId?.variant ||
    '';
  if (!bookingVariant) return true;
  return normalizeVariant(bookingVariant) === normalizeVariant(variant);
}

async function countFleetCapacity(branchId, model, dateStr, variant) {
  const bounds = calendarDayBounds(dateStr);
  if (!bounds) return 0;

  const query = { ...branchFleetQuery(branchId) };
  if (model) query.model = normalizeModel(model);

  const vehicles = await TDVehicle.find(query).select('variant status isLocked availableAgainAt');
  if (!vehicles.length) return 0;

  const pool = vehicles.filter((vehicle) => {
    if (vehicle.isLocked) return false;
    if (vehicle.availableAgainAt && new Date(vehicle.availableAgainAt) > bounds.endOfDay) {
      return false;
    }
    return true;
  });

  if (!variant) return pool.length;

  const exact = pool.filter((v) => normalizeVariant(v.variant) === normalizeVariant(variant));
  if (exact.length > 0) return exact.length;

  // Same model, different trim — still allow booking at model level.
  return pool.length;
}

async function buildSlotOccupancy(branchId, dateStr, model, variant, excludeBookingId = null) {
  const bounds = calendarDayBounds(dateStr);
  if (!bounds) return {};

  const bookingQuery = {
    branchId,
    slotDate: { $gte: bounds.start, $lt: bounds.end },
    bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
  };
  if (model) bookingQuery.preferredModel = normalizeModel(model);

  const bookings = await TDBooking.find(bookingQuery)
    .populate('testDriveId', 'variant model')
    .select('_id slotTime preferredModel preferredVariant testDriveId');

  const occupancy = {};
  for (const booking of bookings) {
    if (excludeBookingId && String(booking._id) === String(excludeBookingId)) continue;
    if (!bookingMatchesVariant(booking, variant)) continue;
    const key = normalizeSlotTimeKey(booking.slotTime);
    if (!key) continue;
    occupancy[key] = (occupancy[key] || 0) + 1;
  }
  return occupancy;
}

function resolveConfiguredSlotTimes(config) {
  if (config.slotTimes?.length > 0) {
    return normalizeSlotTimesList(config.slotTimes);
  }
  return generateSlotTimesFromRules({
    workingStartTime: config.workingStartTime,
    workingEndTime: config.workingEndTime,
    slotDuration: config.slotDuration,
    bufferTime: config.bufferTime,
  });
}

function getAdminDisabledTimes(config, dateStr) {
  const raw = config?.disabledSlotsByDate;
  if (!raw || !dateStr) return [];
  if (raw instanceof Map) return raw.get(dateStr) || [];
  if (typeof raw === 'object') return raw[dateStr] || [];
  return [];
}

async function computeSlotsForBranchDate(branchId, dateStr, options = {}) {
  const config = options.config;
  if (!config) {
    return { slots: [], config: null, fleetCapacity: 0 };
  }

  const normalizedDate = isoDateOnly(dateStr);
  const model = options.model ? normalizeModel(options.model) : null;
  const variant = options.variant ? String(options.variant).trim() : null;
  const blocked = (config.blockedDates || []).includes(normalizedDate);
  const baseTimes = resolveConfiguredSlotTimes(config);
  const disabledForDate = getAdminDisabledTimes(config, normalizedDate);
  const fleetCapacity = await countFleetCapacity(branchId, model, normalizedDate, variant);
  const concurrent = Math.max(Number(config.maxConcurrentBookings) || 2, 1);
  // When a model is chosen, capacity = demo fleet only (coordinator must have a car to assign).
  const effectiveMax =
    fleetCapacity > 0 ? fleetCapacity : model ? 0 : concurrent;
  const bookingCounts = await buildSlotOccupancy(
    branchId,
    normalizedDate,
    model,
    variant,
    options.excludeBookingId || null,
  );

  const slots = baseTimes.map((time) => {
    const count = bookingCounts[time] || 0;
    let reason = null;
    let available = true;

    if (blocked) {
      available = false;
      reason = 'blocked';
    } else if (disabledForDate.includes(time)) {
      available = false;
      reason = 'not_offered';
    } else if (isSlotPast(normalizedDate, time)) {
      available = false;
      reason = 'past';
    } else if (effectiveMax <= 0) {
      available = false;
      reason = 'no_fleet';
    } else if (count >= effectiveMax) {
      available = false;
      reason = 'full';
    }

    return {
      time,
      label: formatTime12h(time),
      available,
      bookings: count,
      maxBookings: effectiveMax,
      fleetAvailable: fleetCapacity,
      fleetCapacity,
      past: reason === 'past',
      reason,
      bookable: available,
    };
  });

  return { slots, config, fleetCapacity };
}

/**
 * Reject booking/reschedule when the slot is not offered, full, past, or has no demo fleet for the model.
 */
async function assertSlotBookableForBooking({
  branchId,
  slotDate,
  slotTime,
  model,
  variant,
  excludeBookingId,
}) {
  if (!branchId || !slotDate || !slotTime) {
    throw new ApiError(400, 'Branch, date, and time are required to book a test drive slot');
  }

  const config = await TDSlotConfig.findOne({ branchId });
  if (!config) {
    throw new ApiError(
      409,
      'No slot configuration exists for this branch. Set up Slot config under Test Drive first.',
    );
  }

  const dateStr = isoDateOnly(slotDate);
  const normalizedModel = model ? normalizeModel(model) : null;
  const { slots, fleetCapacity } = await computeSlotsForBranchDate(branchId, dateStr, {
    model: normalizedModel,
    variant: variant || null,
    config: config.toObject(),
    excludeBookingId: excludeBookingId || null,
  });

  const want = normalizeSlotTimeKey(slotTime);
  const slot = slots.find((s) => normalizeSlotTimeKey(s.time) === want);

  if (!slot) {
    throw new ApiError(400, 'That time is not offered on this date. Pick a time from the available list.');
  }

  if (!slot.available) {
    const reasonMessages = {
      no_fleet: normalizedModel
        ? `No demo ${normalizedModel} is available at this branch on ${dateStr}. Add the model in Demo Fleet or choose another date/time.`
        : 'No demo vehicle capacity for this slot. Choose another date/time.',
      full: 'This time slot is full for that model. Pick another time.',
      past: 'That time has already passed.',
      blocked: 'This date is blocked for test drives.',
      not_offered: 'That time is not offered on this date.',
    };
    throw new ApiError(409, reasonMessages[slot.reason] || 'This slot is not available. Choose another time.');
  }

  if (normalizedModel && fleetCapacity <= 0) {
    throw new ApiError(
      409,
      `No demo ${normalizedModel} is tagged at this branch. Add it in Demo Fleet before booking.`,
    );
  }

  return slot;
}

module.exports = {
  computeSlotsForBranchDate,
  assertSlotBookableForBooking,
  countFleetCapacity,
  normalizeVariant,
  normalizeSlotTimeKey,
  calendarDayBounds,
};
