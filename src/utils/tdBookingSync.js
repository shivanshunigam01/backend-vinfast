require('../models/tdModels');

const TDBooking = require('../models/TDBooking');
const TDBranch = require('../models/TDBranch');
const TestDrive = require('../models/TestDrive');
const { upsertTDCustomer } = require('./tdCustomerResolver');
const { normalizeModel } = require('./tdVehicleLegacyImport');
const { assignNewBookingToTdCoordinator } = require('./tdCoordinatorAssignment');

function normalizeSlotTime(raw) {
  if (!raw) return '10:00';
  const s = String(raw).trim();

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
  if (m24) {
    return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
  }

  return '10:00';
}

function nextBookingId() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TDB-${ymd}-${rand}`;
}

async function resolveBranch(branchName) {
  const name = String(branchName || 'Patna Showroom').trim();
  let branch = await TDBranch.findOne({
    $or: [{ name }, { code: 'PATNA' }, { code: 'PAT' }],
  });

  if (!branch) {
    branch = await TDBranch.create({
      name: 'Patna Showroom',
      code: 'PATNA',
      city: 'Patna',
      phone: '+91 9231445060',
      active: true,
    });
  }
  return branch;
}

function parseSlotDate(preferredDate) {
  const d = new Date(preferredDate);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Create or return existing TDBooking for a legacy/public TestDrive submission.
 */
async function syncTestDriveToTdBooking(testDrive) {
  if (!testDrive?._id) return null;

  const existing = await TDBooking.findOne({ testDriveId: testDrive._id });
  if (existing) return existing;

  const customer = await upsertTDCustomer({
    name: testDrive.customerName,
    mobile: testDrive.mobile,
    email: testDrive.email,
    city: testDrive.city,
  });

  const branch = await resolveBranch(testDrive.branch);
  const slotDate = parseSlotDate(testDrive.preferredDate);
  const slotTime = normalizeSlotTime(testDrive.preferredTime);

  const booking = await TDBooking.create({
    bookingId: nextBookingId(),
    bookingStatus: 'CONFIRMED',
    slotDate,
    slotTime,
    slotDuration: 60,
    preferredModel: normalizeModel(testDrive.model),
    remarks: testDrive.remarks,
    customerId: customer._id,
    branchId: branch._id,
    testDriveId: testDrive._id,
    customerName: testDrive.customerName,
    customerMobile: testDrive.mobile,
    customerEmail: testDrive.email,
    customerCity: testDrive.city,
  });

  await assignNewBookingToTdCoordinator(booking, { notify: true });
  return booking;
}

async function syncAllLegacyTestDrives() {
  const drives = await TestDrive.find({}).sort({ createdAt: 1 });
  let synced = 0;

  for (const drive of drives) {
    const before = await TDBooking.countDocuments({ testDriveId: drive._id });
    if (before > 0) continue;
    await syncTestDriveToTdBooking(drive);
    synced += 1;
  }

  return synced;
}

module.exports = {
  syncTestDriveToTdBooking,
  syncAllLegacyTestDrives,
  normalizeSlotTime,
  nextBookingId,
  resolveBranch,
};
