const mongoose = require('mongoose');
const TDVehicle = require('../models/TDVehicle');

const LEGACY_COLLECTIONS = [
  'demovehicles',
  'demo_vehicles',
  'tdvehicles_legacy',
  'td_demo_vehicles',
  'fleetvehicles',
];

const VALID_STATUSES = new Set([
  'AVAILABLE',
  'BOOKED',
  'RUNNING',
  'CHARGING',
  'REPAIR',
  'BATTERY_LOW',
  'SERVICE_DUE',
]);

function normalizeModel(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'VF 7';
  const up = s.toUpperCase().replace(/\s+/g, '');
  if (up.includes('LIMO')) return 'Limo Green';
  if (up.includes('MPV')) return 'VF MPV 7';
  if (up.includes('VF6')) return 'VF 6';
  if (up.includes('VF7')) return 'VF 7';
  return s;
}

function normalizeStatus(raw) {
  const s = String(raw || 'AVAILABLE').trim().toUpperCase().replace(/\s+/g, '_');
  return VALID_STATUSES.has(s) ? s : 'AVAILABLE';
}

function mapLegacyRow(row) {
  const registrationNo = String(row.registrationNo || row.registration || row.regNo || '').trim();
  const vinNo = String(row.vinNo || row.vin || '').trim();
  const key = registrationNo || vinNo || String(row.vehicleId || row._id || '').trim();
  if (!key) return null;

  return {
    vehicleId: String(row.vehicleId || row.fleetId || `TDV-${key.slice(-6).toUpperCase()}`).trim(),
    model: normalizeModel(row.model),
    variant: String(row.variant || row.trim || '').trim() || undefined,
    registrationNo: registrationNo || undefined,
    vinNo: vinNo || undefined,
    color: String(row.color || row.colour || '').trim() || undefined,
    batteryPercent: Number(row.batteryPercent ?? row.battery ?? 100) || 100,
    currentOdometer: Number(row.currentOdometer ?? row.odometer ?? 0) || 0,
    status: normalizeStatus(row.status),
    totalTestDriveKM: Number(row.totalTestDriveKM ?? row.totalKm ?? 0) || 0,
    totalTestDrives: Number(row.totalTestDrives ?? 0) || 0,
    isLocked: Boolean(row.isLocked),
    branchId: row.branchId || undefined,
    insuranceValidity: row.insuranceValidity ? new Date(row.insuranceValidity) : undefined,
    serviceDueDate: row.serviceDueDate ? new Date(row.serviceDueDate) : undefined,
    availableAgainAt: row.availableAgainAt ? new Date(row.availableAgainAt) : undefined,
  };
}

function branchFleetQuery(branchId) {
  if (!branchId) return {};
  return {
    $or: [
      { branchId },
      { branchId: null },
      { branchId: { $exists: false } },
    ],
  };
}

async function importLegacyTdVehiclesIfEmpty() {
  const existing = await TDVehicle.countDocuments();
  if (existing > 0) return 0;

  const db = mongoose.connection.db;
  let imported = 0;

  for (const collName of LEGACY_COLLECTIONS) {
    let coll;
    try {
      coll = db.collection(collName);
      const n = await coll.countDocuments();
      if (n === 0) continue;
    } catch {
      continue;
    }

    const rows = await coll.find({}).toArray();
    for (const row of rows) {
      const mapped = mapLegacyRow(row);
      if (!mapped) continue;

      const dedupe = mapped.registrationNo
        ? { registrationNo: mapped.registrationNo }
        : mapped.vinNo
          ? { vinNo: mapped.vinNo }
          : { vehicleId: mapped.vehicleId };

      const exists = await TDVehicle.findOne(dedupe);
      if (exists) continue;

      await TDVehicle.create(mapped);
      imported += 1;
    }

    if (imported > 0) break;
  }

  return imported;
}

module.exports = {
  importLegacyTdVehiclesIfEmpty,
  normalizeModel,
  branchFleetQuery,
};
