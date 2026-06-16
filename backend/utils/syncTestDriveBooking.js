const TestDrive = require('../models/TestDrive');
const TDBooking = require('../models/TDBooking');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const { autoAssignExecutive } = require('./executiveAssignment');
const { toLocalMidnight } = require('./timeFormat');

const STATUS_MAP = {
  Pending: 'PENDING',
  Confirmed: 'CONFIRMED',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
  Rescheduled: 'RESCHEDULED'
};

async function resolveBranch(branchName) {
  if (branchName) {
    const byName = await Branch.findOne({ name: branchName, active: true });
    if (byName) return byName;
  }
  let branch = await Branch.findOne({ code: 'PAT', active: true });
  if (branch) return branch;
  branch = await Branch.findOne({ active: true }).sort({ createdAt: 1 });
  if (branch) return branch;

  return Branch.create({
    name: 'Patna Showroom',
    code: 'PAT',
    address: 'Patna, Bihar',
    city: 'Patna',
    active: true
  });
}

async function findOrCreateCustomer(testDrive, branchId) {
  let customer = await Customer.findOne({ mobile: testDrive.mobile });
  if (customer) {
    let dirty = false;
    if (!customer.branchId) {
      customer.branchId = branchId;
      dirty = true;
    }
    if (testDrive.email && !customer.email) {
      customer.email = testDrive.email;
      dirty = true;
    }
    if (testDrive.city && !customer.city) {
      customer.city = testDrive.city;
      dirty = true;
    }
    if (dirty) await customer.save();
    return customer;
  }
  return Customer.create({
    name: testDrive.customerName,
    mobile: testDrive.mobile,
    email: testDrive.email || undefined,
    city: testDrive.city || undefined,
    branchId,
    preferredVehicle: testDrive.model
  });
}

function buildWebsiteRemarks(testDrive) {
  const parts = [
    'Website test drive booking',
    testDrive.preferredTestDriveLocation && `Location: ${testDrive.preferredTestDriveLocation}`,
    testDrive.ownsCar && `Owns car: ${testDrive.ownsCar}${testDrive.currentCarDetails ? ` (${testDrive.currentCarDetails})` : ''}`,
    testDrive.purchaseTimeline && `Purchase plan: ${testDrive.purchaseTimeline}`,
    testDrive.variant && `Trim: ${testDrive.variant}`,
    testDrive.remarks
  ].filter(Boolean);
  return parts.join(' | ');
}

function normalizeSlotDate(preferredDate) {
  return toLocalMidnight(preferredDate) || new Date(preferredDate);
}

async function updateTDBookingFromTestDrive(booking, testDrive) {
  const updates = {
    slotDate: normalizeSlotDate(testDrive.preferredDate),
    slotTime: testDrive.preferredTime,
    preferredModel: testDrive.model,
    preferredVariant: testDrive.variant || '',
    bookingStatus: STATUS_MAP[testDrive.status] || booking.bookingStatus,
    remarks: buildWebsiteRemarks(testDrive)
  };
  if (testDrive.assignedExecutive) {
    updates.assignedExecutive = testDrive.assignedExecutive;
  }
  return TDBooking.findByIdAndUpdate(booking._id, updates, { new: true, runValidators: true });
}

async function syncTestDriveToTDBooking(testDrive) {
  if (!testDrive?._id) return null;

  if (testDrive.tdBookingId) {
    const linked = await TDBooking.findById(testDrive.tdBookingId);
    if (linked) return updateTDBookingFromTestDrive(linked, testDrive);
  }

  const existing = await TDBooking.findOne({ testDriveId: testDrive._id });
  if (existing) {
    await TestDrive.findByIdAndUpdate(testDrive._id, { tdBookingId: existing._id });
    return updateTDBookingFromTestDrive(existing, testDrive);
  }

  const branch = await resolveBranch(testDrive.branch);
  if (!branch) {
    console.warn(`[syncTestDrive] No branch found — skipping TDBooking sync for ${testDrive._id}`);
    return null;
  }

  const customer = await findOrCreateCustomer(testDrive, branch._id);
  const slotDate = normalizeSlotDate(testDrive.preferredDate);
  const executive =
    testDrive.assignedExecutive ||
    (await autoAssignExecutive(branch._id, slotDate, testDrive.preferredTime));

  const booking = await TDBooking.create({
    testDriveId: testDrive._id,
    customerId: customer._id,
    branchId: branch._id,
    assignedExecutive: executive?._id,
    slotDate,
    slotTime: testDrive.preferredTime,
    preferredModel: testDrive.model,
    preferredVariant: testDrive.variant || '',
    bookingStatus: STATUS_MAP[testDrive.status] || 'PENDING',
    dlVerified: false,
    remarks: buildWebsiteRemarks(testDrive)
  });

  await TestDrive.findByIdAndUpdate(testDrive._id, { tdBookingId: booking._id });
  return booking;
}

async function syncUnlinkedTestDrives(limit = 100) {
  const unlinked = await TestDrive.find({
    $or: [{ tdBookingId: { $exists: false } }, { tdBookingId: null }]
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  const synced = [];
  for (const testDrive of unlinked) {
    const booking = await syncTestDriveToTDBooking(testDrive);
    if (booking) synced.push(booking);
  }
  return synced;
}

module.exports = { syncTestDriveToTDBooking, syncUnlinkedTestDrives };
