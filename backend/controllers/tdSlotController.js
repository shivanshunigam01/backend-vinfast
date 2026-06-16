const TDSlotConfig = require('../models/TDSlotConfig');
const Branch = require('../models/Branch');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getAvailableSlots, countFleetCapacity } = require('../utils/slotEngine');
const { formatTime12h, toCalendarDateStr } = require('../utils/timeFormat');
const { normalizeSlotTimesList, resolveConfiguredSlotTimes } = require('../utils/slotSchedule');

exports.getSlotConfig = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) throw new ApiError(400, 'branchId is required');
  const config = await TDSlotConfig.findOne({ branchId, active: true }).populate('branchId', 'name code');
  if (!config) throw new ApiError(404, 'Slot configuration not found for this branch');
  res.json({ success: true, data: config });
});

exports.getAllConfigs = asyncHandler(async (req, res) => {
  const configs = await TDSlotConfig.find({ active: true }).populate('branchId', 'name code');
  res.json({ success: true, data: configs });
});

exports.upsertSlotConfig = asyncHandler(async (req, res) => {
  const { branchId } = req.body;
  if (!branchId) throw new ApiError(400, 'branchId is required');

  const branch = await Branch.findById(branchId);
  if (!branch) throw new ApiError(404, 'Branch not found');

  const payload = { ...req.body };
  if (payload.slotTimes) {
    payload.slotTimes = normalizeSlotTimesList(payload.slotTimes);
  }

  const config = await TDSlotConfig.findOneAndUpdate(
    { branchId },
    payload,
    { upsert: true, new: true, runValidators: true }
  ).populate('branchId', 'name code');

  res.json({ success: true, data: config });
});

/** Public: read-only slot schedule for a branch (no auth). */
exports.getPublicSlotConfig = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) throw new ApiError(400, 'branchId is required');

  const config = await TDSlotConfig.findOne({ branchId, active: true });
  if (!config) throw new ApiError(404, 'No slot configuration found for this branch');

  const slotTimes = resolveConfiguredSlotTimes(config);

  res.json({
    success: true,
    data: {
      branchId: config.branchId,
      workingStartTime: config.workingStartTime,
      workingEndTime: config.workingEndTime,
      slotDuration: config.slotDuration,
      bufferTime: config.bufferTime,
      maxConcurrentBookings: config.maxConcurrentBookings,
      slotTimes,
      slotLabels: slotTimes.map((t) => formatTime12h(t))
    }
  });
});

exports.getAvailableSlotsForDate = asyncHandler(async (req, res) => {
  const { branchId, date, model, variant } = req.query;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const config = await TDSlotConfig.findOne({ branchId, active: true });
  if (!config) throw new ApiError(404, 'No slot configuration found for this branch');

  const dateStr = toCalendarDateStr(date);
  if (!dateStr) throw new ApiError(400, 'Invalid date format — use YYYY-MM-DD');
  const isBlocked = config.blockedDates.includes(dateStr);

  const fleetCapacity = await countFleetCapacity(branchId, model || null, dateStr, variant || null);
  const configObj = config.toObject();
  const slotTimes = resolveConfiguredSlotTimes(configObj);

  const slots = await getAvailableSlots(branchId, dateStr, configObj, {
    model: model || null,
    variant: variant || null,
    forceUnavailable: isBlocked,
    unavailableReason: isBlocked ? 'blocked' : undefined
  });

  res.json({
    success: true,
    data: slots.map((s) => ({
      ...s,
      label: formatTime12h(s.time)
    })),
    slotDuration: config.slotDuration,
    bufferTime: config.bufferTime,
    workingStartTime: config.workingStartTime,
    workingEndTime: config.workingEndTime,
    slotTimes,
    fleetCapacity,
    fleetAvailable: fleetCapacity,
    maxConcurrentBookings: config.maxConcurrentBookings,
    ...(model ? { model } : {}),
    ...(variant ? { variant } : {}),
    ...(isBlocked ? { message: 'This date is blocked for bookings' } : {})
  });
});

exports.blockDate = asyncHandler(async (req, res) => {
  const { branchId, date } = req.body;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const config = await TDSlotConfig.findOne({ branchId });
  if (!config) throw new ApiError(404, 'Slot configuration not found');

  const dateStr = new Date(date).toISOString().split('T')[0];
  if (!config.blockedDates.includes(dateStr)) {
    config.blockedDates.push(dateStr);
    await config.save();
  }

  res.json({ success: true, message: `Date ${dateStr} blocked`, data: config });
});

exports.unblockDate = asyncHandler(async (req, res) => {
  const { branchId, date } = req.body;
  const config = await TDSlotConfig.findOne({ branchId });
  if (!config) throw new ApiError(404, 'Slot configuration not found');

  const dateStr = new Date(date).toISOString().split('T')[0];
  config.blockedDates = config.blockedDates.filter((d) => d !== dateStr);
  await config.save();

  res.json({ success: true, message: `Date ${dateStr} unblocked`, data: config });
});

/** Admin: set which slot times are manually closed for a specific date. */
exports.setDateSlotOverrides = asyncHandler(async (req, res) => {
  const { branchId, date, disabledTimes } = req.body;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const dateStr = toCalendarDateStr(date);
  if (!dateStr) throw new ApiError(400, 'Invalid date — use YYYY-MM-DD');

  const config = await TDSlotConfig.findOne({ branchId, active: true });
  if (!config) throw new ApiError(404, 'Slot configuration not found for this branch');

  const normalized = normalizeSlotTimesList(disabledTimes || []);
  if (!config.disabledSlotsByDate) config.disabledSlotsByDate = new Map();
  config.disabledSlotsByDate.set(dateStr, normalized);
  config.markModified('disabledSlotsByDate');
  await config.save();

  res.json({
    success: true,
    message: `Slot overrides saved for ${dateStr}`,
    data: { date: dateStr, disabledTimes: normalized }
  });
});
