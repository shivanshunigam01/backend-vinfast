require('../models/tdModels');

const TDSlotConfig = require('../models/TDSlotConfig');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { normalizeSlotTimesList, isoDateOnly } = require('../utils/tdSlotUtils');
const { computeSlotsForBranchDate: buildSlots } = require('../utils/tdSlotAvailability');
const { ensureTdBranch, ensureTdSlotConfig, ensureTdFleet } = require('../utils/tdBootstrap');

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

async function ensureBranchSlotData(branchId) {
  const branch = await ensureTdBranch();
  const resolvedBranchId = branchId || branch._id;
  await ensureTdFleet(resolvedBranchId);
  await ensureTdSlotConfig(resolvedBranchId);
  return getConfigForBranch(resolvedBranchId);
}

async function computeSlotsForBranchDate(branchId, dateStr, options = {}) {
  const config = options.config || (await getConfigForBranch(branchId));
  if (!config) {
    return { slots: [], config: null, fleetCapacity: 0 };
  }
  return buildSlots(branchId, String(dateStr), {
    ...options,
    config: typeof config.toObject === 'function' ? config.toObject() : config,
  });
}

function slotQueryOptions(req) {
  return {
    model: req.query.model ? String(req.query.model).trim() : null,
    variant: req.query.variant ? String(req.query.variant).trim() : null,
  };
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

  const config = await ensureBranchSlotData(branchId);
  const { slots, fleetCapacity } = await computeSlotsForBranchDate(branchId, String(date), {
    ...slotQueryOptions(req),
    config,
  });

  return successResponse(res, slots, undefined, 200, {
    slotDuration: config?.slotDuration,
    bufferTime: config?.bufferTime,
    workingStartTime: config?.workingStartTime,
    workingEndTime: config?.workingEndTime,
    maxConcurrentBookings: config?.maxConcurrentBookings,
    fleetAvailable: fleetCapacity,
    fleetCapacity,
  });
});

exports.publicAvailableSlots = asyncHandler(async (req, res) => {
  const { branchId, date } = req.query;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const config = await ensureBranchSlotData(branchId);
  const options = slotQueryOptions(req);
  const { slots, fleetCapacity } = await computeSlotsForBranchDate(branchId, String(date), {
    ...options,
    config,
  });

  const message =
    slots.length === 0
      ? 'No test drive times are configured yet. Please call the showroom to book.'
      : fleetCapacity === 0 && options.model
        ? `No demo ${options.model}${options.variant ? ` ${options.variant}` : ''} is scheduled for this date. Try another trim or date.`
        : undefined;

  return res.status(200).json({
    success: true,
    data: slots,
    slotDuration: config?.slotDuration,
    bufferTime: config?.bufferTime,
    workingStartTime: config?.workingStartTime,
    workingEndTime: config?.workingEndTime,
    maxConcurrentBookings: config?.maxConcurrentBookings,
    fleetAvailable: fleetCapacity,
    fleetCapacity,
    ...(options.model ? { model: options.model } : {}),
    ...(options.variant ? { variant: options.variant } : {}),
    ...(message ? { message } : {}),
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
