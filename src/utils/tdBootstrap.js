/**
 * Ensures TD module master data exists and syncs legacy TestDrive → TDBooking.
 */
require('../models/tdModels');

const mongoose = require('mongoose');
const TDBranch = require('../models/TDBranch');
const TDSlotConfig = require('../models/TDSlotConfig');
const TDVehicle = require('../models/TDVehicle');
const TDStaff = require('../models/TDStaff');
const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const { importLegacyTdVehiclesIfEmpty, normalizeModel } = require('./tdVehicleLegacyImport');
const { syncTestDriveToTdBooking, syncAllLegacyTestDrives } = require('./tdBookingSync');

const DEFAULT_STAFF_PASSWORD = process.env.SEED_TD_STAFF_PASSWORD || 'ChangeMe123!';

const BRANCH_SEED = {
  name: 'Patna Showroom',
  code: 'PATNA',
  city: 'Patna',
  phone: '+91 9231445060',
  active: true,
};

const STAFF_SEED = [
  { name: 'Amit Sharma', email: 'amit.sharma@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Priya Singh', email: 'priya.singh@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Rohan Verma', email: 'rohan.verma@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Vikram Rao', email: 'vikram.rao@patliputravinfast.com', designation: 'sales_executive' },
  { name: 'Neha Kapoor', email: 'neha.kapoor@patliputravinfast.com', designation: 'sales_manager' },
  { name: 'Rajesh Kumar', email: 'rajesh.kumar@patliputravinfast.com', designation: 'branch_manager' },
  { name: 'General Manager', email: 'gm@patliputravinfast.com', designation: 'gm' },
  { name: 'Chief Executive', email: 'ceo@patliputravinfast.com', designation: 'ceo' },
  { name: 'Managing Director', email: 'md@patliputravinfast.com', designation: 'md' },
];

const FLEET_SEED = [
  {
    vehicleId: 'TDV-VF7-001',
    model: 'VF 7',
    variant: 'Wind',
    registrationNo: 'BR01TD7001',
    color: 'Zenith Grey',
    batteryPercent: 92,
    currentOdometer: 1240,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF7-002',
    model: 'VF 7',
    variant: 'Earth',
    registrationNo: 'BR01TD7002',
    color: 'Infinity Blanc',
    batteryPercent: 88,
    currentOdometer: 980,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF7-003',
    model: 'VF 7',
    variant: 'Wind Infinity',
    registrationNo: 'BR01TD7003',
    color: 'Desert Silver',
    batteryPercent: 90,
    currentOdometer: 640,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF7-004',
    model: 'VF 7',
    variant: 'Sky',
    registrationNo: 'BR01TD7004',
    color: 'Crimson Red',
    batteryPercent: 86,
    currentOdometer: 1120,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF7-005',
    model: 'VF 7',
    variant: 'Sky Infinity',
    registrationNo: 'BR01TD7005',
    color: 'Urban Mint',
    batteryPercent: 94,
    currentOdometer: 520,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF7-006',
    model: 'VF 7',
    variant: 'Wind',
    registrationNo: 'BR01TD7006',
    color: 'Jet Black',
    batteryPercent: 91,
    currentOdometer: 890,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF6-001',
    model: 'VF 6',
    variant: 'Wind',
    registrationNo: 'BR01TD6001',
    color: 'Crimson Red',
    batteryPercent: 95,
    currentOdometer: 760,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF6-002',
    model: 'VF 6',
    variant: 'Earth',
    registrationNo: 'BR01TD6002',
    color: 'Jet Black',
    batteryPercent: 88,
    currentOdometer: 1450,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF6-003',
    model: 'VF 6',
    variant: 'Wind Infinity',
    registrationNo: 'BR01TD6003',
    color: 'Infinity Blanc',
    batteryPercent: 93,
    currentOdometer: 430,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF6-004',
    model: 'VF 6',
    variant: 'Earth',
    registrationNo: 'BR01TD6004',
    color: 'Zenith Grey',
    batteryPercent: 87,
    currentOdometer: 1680,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF6-005',
    model: 'VF 6',
    variant: 'Wind',
    registrationNo: 'BR01TD6005',
    color: 'Desert Silver',
    batteryPercent: 96,
    currentOdometer: 310,
    status: 'AVAILABLE',
  },
  {
    vehicleId: 'TDV-VF6-006',
    model: 'VF 6',
    variant: 'Wind Infinity',
    registrationNo: 'BR01TD6006',
    color: 'Urban Mint',
    batteryPercent: 84,
    currentOdometer: 920,
    status: 'AVAILABLE',
  },
];

const DEFAULT_SLOT_TIMES = [
  '10:00',
  '11:15',
  '12:30',
  '14:00',
  '15:15',
  '16:30',
  '17:45',
];

function staffRole(designation) {
  return designation === 'sales_executive' ? 'executive' : 'manager';
}

async function importLegacyStaffIfEmpty() {
  if ((await TDStaff.countDocuments()) > 0) return 0;

  const db = mongoose.connection.db;
  const legacyNames = ['tdusers', 'td_users', 'tdstaffs', 'staffusers'];
  let imported = 0;

  for (const collName of legacyNames) {
    let coll;
    try {
      coll = db.collection(collName);
      if ((await coll.countDocuments()) === 0) continue;
    } catch {
      continue;
    }

    const rows = await coll.find({}).toArray();
    for (const row of rows) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email) continue;
      const designation = row.designation || row.role || 'sales_executive';
      const exists = await TDStaff.findOne({ email });
      if (exists) continue;
      await TDStaff.create({
        name: String(row.name || row.fullName || email.split('@')[0]).trim(),
        email,
        password: DEFAULT_STAFF_PASSWORD,
        designation,
        role: staffRole(designation),
        active: row.active !== false,
      });
      imported += 1;
    }
    if (imported > 0) break;
  }
  return imported;
}

async function ensureTdBranch() {
  let branch = await TDBranch.findOne({
    $or: [{ code: BRANCH_SEED.code }, { code: 'PAT' }, { name: BRANCH_SEED.name }],
  });
  if (!branch) {
    branch = await TDBranch.create(BRANCH_SEED);
  }
  return branch;
}

async function ensureTdSlotConfig(branchId) {
  let config = await TDSlotConfig.findOne({ branchId });
  if (config) return config;

  return TDSlotConfig.create({
    branchId,
    slotDuration: 60,
    bufferTime: 15,
    workingStartTime: '09:00',
    workingEndTime: '18:00',
    maxConcurrentBookings: 2,
    autoExpiry: true,
    slotTimes: DEFAULT_SLOT_TIMES,
    blockedDates: [],
    disabledSlotsByDate: {},
  });
}

async function ensureTdFleet(branchId) {
  const totalBefore = await TDVehicle.countDocuments();
  if (totalBefore === 0) {
    const legacyImported = await importLegacyTdVehiclesIfEmpty();
    if (legacyImported > 0) return legacyImported;
  }

  let created = 0;
  for (const row of FLEET_SEED) {
    const exists = await TDVehicle.findOne({
      $or: [{ vehicleId: row.vehicleId }, { registrationNo: row.registrationNo }],
    });
    if (exists) continue;
    await TDVehicle.create({
      ...row,
      model: normalizeModel(row.model),
      branchId,
      isLocked: false,
      totalTestDrives: 0,
      totalTestDriveKM: 0,
    });
    created += 1;
  }
  return created;
}

async function ensureTdStaff() {
  const legacy = await importLegacyStaffIfEmpty();
  if (legacy > 0) return legacy;

  let created = 0;
  for (const row of STAFF_SEED) {
    const exists = await TDStaff.findOne({ email: row.email });
    if (exists) continue;
    await TDStaff.create({
      name: row.name,
      email: row.email,
      password: DEFAULT_STAFF_PASSWORD,
      designation: row.designation,
      role: staffRole(row.designation),
      active: true,
    });
    created += 1;
  }
  return created;
}

let bootstrapPromise = null;

/**
 * Idempotent: seeds empty TD collections and syncs legacy TestDrive rows.
 * Safe to call on every server start (TD_AUTO_BOOTSTRAP !== 'false').
 */
async function ensureTdModuleReady() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const branch = await ensureTdBranch();
    const results = {
      branch: branch.name,
      slotConfig: Boolean(await ensureTdSlotConfig(branch._id)),
      fleetCreated: await ensureTdFleet(branch._id),
      staffCreated: await ensureTdStaff(),
      bookingsSynced: await syncAllLegacyTestDrives(),
    };

    const anyWork =
      results.fleetCreated > 0 ||
      results.staffCreated > 0 ||
      results.bookingsSynced > 0;

    if (anyWork) {
      console.log('[TD bootstrap]', JSON.stringify(results));
    }
    return results;
  })().catch((err) => {
    bootstrapPromise = null;
    console.error('[TD bootstrap] failed:', err.message);
    throw err;
  });

  return bootstrapPromise;
}

module.exports = {
  ensureTdModuleReady,
  ensureTdBranch,
  ensureTdSlotConfig,
  ensureTdFleet,
  ensureTdStaff,
  BRANCH_SEED,
  STAFF_SEED,
  FLEET_SEED,
  DEFAULT_SLOT_TIMES,
};
