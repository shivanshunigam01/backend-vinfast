const Branch = require('../models/Branch');
const TDSlotConfig = require('../models/TDSlotConfig');
const { assertSlotBookable } = require('./slotEngine');
const { normalizeTimeTo24h } = require('./timeFormat');

async function resolveBranchForBooking(branchName) {
  if (branchName) {
    const byName = await Branch.findOne({ name: branchName, active: true });
    if (byName) return byName;
  }
  let branch = await Branch.findOne({ code: 'PAT', active: true });
  if (branch) return branch;
  return Branch.findOne({ active: true }).sort({ createdAt: 1 });
}

async function validatePublicTestDriveSlot({ branch, preferredDate, preferredTime, model, variant }) {
  const resolvedBranch = await resolveBranchForBooking(branch);
  if (!resolvedBranch) {
    const err = new Error('Showroom branch is not configured yet. Please call us to book.');
    err.statusCode = 503;
    throw err;
  }

  const config = await TDSlotConfig.findOne({ branchId: resolvedBranch._id, active: true });
  if (!config) {
    const err = new Error('Test drive scheduling is not configured yet. Please call us to book.');
    err.statusCode = 503;
    throw err;
  }

  const normalizedTime = await assertSlotBookable({
    branchId: resolvedBranch._id,
    slotDate: preferredDate,
    slotTime: preferredTime,
    model,
    variant,
    config: config.toObject()
  });

  return { branch: resolvedBranch, normalizedTime, config };
}

module.exports = { resolveBranchForBooking, validatePublicTestDriveSlot, normalizeTimeTo24h };
