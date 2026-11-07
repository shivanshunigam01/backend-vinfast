const TDBooking = require('../models/TDBooking');
const TDVehicle = require('../models/TDVehicle');
const TDSlotConfig = require('../models/TDSlotConfig');
const { branchFleetQuery, normalizeModel } = require('./tdVehicleLegacyImport');
const { baseProductModel } = require('./leadModel');
const {
  countFleetCapacity,
  normalizeVariant,
  normalizeSlotTimeKey,
  calendarDayBounds,
} = require('./tdSlotAvailability');
const { isoDateOnly } = require('./tdSlotUtils');
const { resolveBranch } = require('./tdBookingSync');
const { getActiveModelNames } = require('./vehicleCatalog');

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'];
const ASSIGNABLE_STATUSES = new Set(['AVAILABLE', 'BOOKED']);

function bookingBranchId(booking) {
  const b = booking?.branchId;
  if (!b) return null;
  return b._id || b;
}

function trimLabelFromStoredModel(raw, baseModel) {
  const s = String(raw || '').trim();
  const base = String(baseModel || '').trim();
  if (!s || !base || s === base) return '';
  if (s.startsWith(`${base} `)) return s.slice(base.length + 1).trim();
  return '';
}

function resolveBookingModelVariant(booking) {
  const rawPreferred = String(booking?.preferredModel || booking?.testDriveId?.model || '').trim();
  const base = baseProductModel(rawPreferred) || rawPreferred;
  const model = normalizeModel(base || rawPreferred);

  let variant = String(booking?.preferredVariant || booking?.testDriveId?.variant || '').trim();
  if (!variant) {
    variant = trimLabelFromStoredModel(rawPreferred, model);
  }
  if (variant.startsWith(`${model} `)) {
    variant = variant.slice(model.length + 1).trim();
  }
  return { model, variant, modelRaw: rawPreferred || model };
}

function bookingModel(booking) {
  return resolveBookingModelVariant(booking).model;
}

function bookingVariant(booking) {
  return resolveBookingModelVariant(booking).variant;
}

function vehicleFleetReason(vehicle, bounds) {
  if (vehicle.isLocked) return 'locked';
  if (vehicle.availableAgainAt && new Date(vehicle.availableAgainAt) > bounds.endOfDay) {
    return 'unavailable_until_later';
  }
  if (!ASSIGNABLE_STATUSES.has(String(vehicle.status || '').toUpperCase())) {
    return `status_${String(vehicle.status || 'unknown').toLowerCase()}`;
  }
  return null;
}

/**
 * Demo vehicles assignable to this booking: branch + model master + slot occupancy.
 */
async function listAssignableVehiclesForBooking(bookingDoc) {
  const booking = bookingDoc?.toObject ? bookingDoc.toObject() : bookingDoc;
  if (!booking) {
    return { vehicles: [], meta: { error: 'booking_not_found' } };
  }

  let branchId = bookingBranchId(booking);
  let branchName = booking.branchId?.name || null;
  if (!branchId) {
    const fallback = await resolveBranch(null);
    branchId = fallback._id;
    branchName = fallback.name;
  }

  const { model, variant, modelRaw } = resolveBookingModelVariant(booking);
  const catalogModels = await getActiveModelNames();
  const modelInCatalog = catalogModels.includes(modelRaw) || catalogModels.includes(model);

  const dateStr = isoDateOnly(booking.slotDate);
  const slotTimeKey = normalizeSlotTimeKey(booking.slotTime);
  const bounds = calendarDayBounds(dateStr);

  const slotConfig = await TDSlotConfig.findOne({ branchId }).lean();
  const fleetCapacity = bounds
    ? await countFleetCapacity(branchId, model, dateStr, variant || null)
    : 0;

  let slotBookingsAtTime = 0;
  const blockedBySlot = new Set();
  if (bounds && slotTimeKey) {
    const sameSlot = await TDBooking.find({
      branchId,
      slotDate: { $gte: bounds.start, $lt: bounds.end },
      bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
    })
      .populate('testDriveId', 'variant model')
      .select('slotTime vehicleId preferredVariant testDriveId _id');

    for (const row of sameSlot) {
      const key = normalizeSlotTimeKey(row.slotTime);
      if (key !== slotTimeKey) continue;
      slotBookingsAtTime += 1;
      if (row.vehicleId && String(row._id) !== String(booking._id)) {
        blockedBySlot.add(String(row.vehicleId));
      }
    }
  }

  const fleetQuery = { ...branchFleetQuery(branchId) };
  if (model) fleetQuery.model = model;

  let fleet = await TDVehicle.find(fleetQuery).sort({ registrationNo: 1 }).lean();

  if (variant) {
    const exact = fleet.filter((v) => normalizeVariant(v.variant) === normalizeVariant(variant));
    if (exact.length > 0) fleet = exact;
  }

  const currentVehicleId = booking.vehicleId?._id
    ? String(booking.vehicleId._id)
    : booking.vehicleId
      ? String(booking.vehicleId)
      : null;

  const vehicles = fleet.map((v) => {
    const id = String(v._id);
    const fleetBlock = bounds ? vehicleFleetReason(v, bounds) : 'invalid_date';
    let assignable = !fleetBlock;
    let reason = fleetBlock;

    if (assignable && blockedBySlot.has(id) && id !== currentVehicleId) {
      assignable = false;
      reason = 'booked_same_slot';
    }

    if (id === currentVehicleId) {
      assignable = true;
      reason = null;
    }

    return {
      _id: v._id,
      vehicleId: v.vehicleId,
      model: v.model,
      variant: v.variant || '',
      registrationNo: v.registrationNo,
      color: v.color,
      status: v.status,
      batteryPercent: v.batteryPercent ?? 0,
      currentOdometer: v.currentOdometer ?? 0,
      isLocked: Boolean(v.isLocked),
      availableAgainAt: v.availableAgainAt || null,
      assignable,
      unavailableReason: reason,
      isCurrentAssignment: id === currentVehicleId,
    };
  });

  const assignableCount = vehicles.filter((v) => v.assignable).length;

  return {
    vehicles,
    meta: {
      branchId,
      branchName,
      model,
      modelRaw,
      modelInCatalog,
      variant: variant || null,
      slotDate: dateStr,
      slotTime: booking.slotTime,
      slotTimeKey,
      fleetCapacity,
      slotBookingsAtTime,
      assignableCount,
      fleetTotalForModel: fleet.length,
      slotConfigured: Boolean(slotConfig),
    },
  };
}

module.exports = {
  listAssignableVehiclesForBooking,
};
