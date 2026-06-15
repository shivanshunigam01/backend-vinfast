require('../models/tdModels');

const TDSlotConfig = require('../models/TDSlotConfig');
const TDBooking = require('../models/TDBooking');
const TDVehicle = require('../models/TDVehicle');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const {
  generateSlotTimesFromRules,
  normalizeSlotTimesList,
  isoDateOnly,
  isSlotPast,
  formatTime12h,
} = require('../utils/tdSlotUtils');

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'];

function formatSlotConfig(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const branch = plain.branchId && typeof plain.branchId === 'object' ? plain.branchId : null;
  return {
    _id: plain._id,
    branchId: branch ? { _id: branch._id, name: branch.name, code: branch.code } : plain.branchId,
    slotDuration: plain.slotDuration,
    bufferTime: plain.bufferTime,
    workingStartTime: plain.workingStartTime,
    workingEndTime: plain.workingEndTime,
    maxConcurrentBookings: plain.maxConcurrentBookings,
    autoExpiry: Boolean(plain.autoExpiry),
    blockedDates: plain.blockedDates || [],
    slotTimes: plain.slotTimes || [],
    disabledSlotsByDate: plain.disabledSlotsByDate || {},
  };
}

async function getConfigForBranch(branchId) {
  return TDSlotConfig.findOne({ branchId }).populate('branchId', 'name code');
}

async function computeSlotsForBranchDate(branchId, dateStr) {
  const config = await getConfigForBranch(branchId);
  if (!config) {
    return { slots: [], config: null };
  }

  const blocked = (config.blockedDates || []).includes(dateStr);
  const baseTimes =
    config.slotTimes?.length > 0
      ? normalizeSlotTimesList(config.slotTimes)
      : generateSlotTimesFromRules({
          workingStartTime: config.workingStartTime,
          workingEndTime: config.workingEndTime,
          slotDuration: config.slotDuration,
          bufferTime: config.bufferTime,
        });

  const disabledForDate = (config.disabledSlotsByDate && config.disabledSlotsByDate[dateStr]) || [];

  const dayStart = new Date(dateStr);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const bookings = await TDBooking.find({
    branchId,
    slotDate: { $gte: dayStart, $lt: dayEnd },
    bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
  }).select('slotTime');

  const bookingCounts = {};
  for (const b of bookings) {
    bookingCounts[b.slotTime] = (bookingCounts[b.slotTime] || 0) + 1;
  }

  const fleetAvailable = await TDVehicle.countDocuments({
    branchId,
    status: 'AVAILABLE',
    isLocked: { $ne: true },
  });

  const maxBookings = config.maxConcurrentBookings || 1;
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
    } else if (isSlotPast(dateStr, time)) {
      available = false;
      reason = 'past';
    } else if (fleetAvailable <= 0) {
      available = false;
      reason = 'no_fleet';
    } else if (count >= maxBookings) {
      available = false;
      reason = 'full';
    }

    return {
      time,
      label: formatTime12h(time),
      available,
      bookings: count,
      maxBookings,
      fleetAvailable,
      past: reason === 'past',
      reason,
      bookable: available,
    };
  });

  return { slots, config };
}

exports.listConfigs = asyncHandler(async (req, res) => {
  const docs = await TDSlotConfig.find({}).populate('branchId', 'name code').sort({ createdAt: -1 });
  return successResponse(res, docs.map(formatSlotConfig));
});

exports.saveConfig = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.branchId) throw new ApiError(400, 'branchId is required');

  const patch = {
    branchId: body.branchId,
    slotDuration: Number(body.slotDuration) || 60,
    bufferTime: Number(body.bufferTime) || 15,
    workingStartTime: body.workingStartTime || '09:00',
    workingEndTime: body.workingEndTime || '18:00',
    maxConcurrentBookings: Number(body.maxConcurrentBookings) || 2,
    autoExpiry: body.autoExpiry !== false,
    slotTimes: normalizeSlotTimesList(body.slotTimes || []),
  };

  const doc = await TDSlotConfig.findOneAndUpdate(
    { branchId: body.branchId },
    { $set: patch },
    { upsert: true, new: true, runValidators: true },
  ).populate('branchId', 'name code');

  return successResponse(res, formatSlotConfig(doc), 'Slot configuration saved');
});

exports.availableSlots = asyncHandler(async (req, res) => {
  const { branchId, date } = req.query;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const { slots, config } = await computeSlotsForBranchDate(branchId, String(date));

  return successResponse(res, slots, undefined, 200, {
    slotDuration: config?.slotDuration,
    workingStartTime: config?.workingStartTime,
    workingEndTime: config?.workingEndTime,
    maxConcurrentBookings: config?.maxConcurrentBookings,
    fleetAvailable: slots[0]?.fleetAvailable,
  });
});

exports.publicAvailableSlots = asyncHandler(async (req, res) => {
  const { branchId, date } = req.query;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const { slots, config } = await computeSlotsForBranchDate(branchId, String(date));

  return res.status(200).json({
    success: true,
    data: slots,
    slotDuration: config?.slotDuration,
    workingStartTime: config?.workingStartTime,
    workingEndTime: config?.workingEndTime,
    maxConcurrentBookings: config?.maxConcurrentBookings,
    fleetAvailable: slots[0]?.fleetAvailable,
  });
});

exports.saveDateOverrides = asyncHandler(async (req, res) => {
  const { branchId, date, disabledTimes } = req.body || {};
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const config = await getConfigForBranch(branchId);
  if (!config) throw new ApiError(404, 'Slot configuration not found for branch');

  const map = { ...(config.disabledSlotsByDate || {}) };
  map[String(date)] = normalizeSlotTimesList(disabledTimes || []);
  config.disabledSlotsByDate = map;
  await config.save();
  await config.populate('branchId', 'name code');

  return successResponse(res, formatSlotConfig(config), 'Daily slot overrides saved');
});

exports.blockDate = asyncHandler(async (req, res) => {
  const { branchId, date } = req.body || {};
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const config = await TDSlotConfig.findOneAndUpdate(
    { branchId },
    { $addToSet: { blockedDates: String(date) } },
    { new: true, upsert: true },
  ).populate('branchId', 'name code');

  return successResponse(res, formatSlotConfig(config), 'Date blocked');
});

exports.unblockDate = asyncHandler(async (req, res) => {
  const { branchId, date } = req.body || {};
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const config = await TDSlotConfig.findOneAndUpdate(
    { branchId },
    { $pull: { blockedDates: String(date) } },
    { new: true },
  ).populate('branchId', 'name code');

  if (!config) throw new ApiError(404, 'Slot configuration not found');
  return successResponse(res, formatSlotConfig(config), 'Date unblocked');
});

exports.computeSlotsForBranchDate = computeSlotsForBranchDate;
