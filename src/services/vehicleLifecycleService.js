const ApiError = require('../utils/apiError');
const {
  PO_STATUS_TRANSITIONS,
  VEHICLE_STATUS_TRANSITIONS,
  AGEING_BUCKETS,
} = require('../constants/stockPipeline');
const { logStatusChange } = require('./auditService');

function canTransitionPo(from, to) {
  const allowed = PO_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function canTransitionVehicle(from, to) {
  const allowed = VEHICLE_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function assertPoTransition(from, to) {
  if (!canTransitionPo(from, to)) {
    throw new ApiError(400, `Invalid PO status transition: ${from} → ${to}`);
  }
}

function assertVehicleTransition(from, to) {
  if (!canTransitionVehicle(from, to)) {
    throw new ApiError(400, `Invalid vehicle status transition: ${from} → ${to}`);
  }
}

async function transitionVehicleStatus(stock, toStatus, admin, remarks) {
  const from = stock.vehicleStatus || stock.status;
  assertVehicleTransition(from, toStatus);
  stock.vehicleStatus = toStatus;
  stock.status = mapVehicleStatusToLegacy(stock.vehicleStatus);
  await stock.save();
  await logStatusChange('VehicleStock', stock._id, from, toStatus, admin, remarks);
  return stock;
}

function mapVehicleStatusToLegacy(vehicleStatus) {
  switch (vehicleStatus) {
    case 'IN_TRANSIT':
    case 'ARRIVED':
    case 'RECEIVED':
    case 'EXCEPTION':
    case 'RECEIPT_ACCEPTED':
    case 'HOLD':
    case 'PDI_PENDING':
    case 'PDI_FAIL':
    case 'PDI_HOLD':
    case 'WORKSHOP':
    case 'BLOCKED':
    case 'DAMAGED':
      return 'IN_TRANSIT';
    case 'PDI_PASS':
    case 'AVAILABLE':
      return 'FRESH_STOCK';
    case 'RESERVED':
    case 'BOOKED':
    case 'INVOICED':
    case 'DELIVERY_READY':
      return 'RESERVED';
    case 'DELIVERED':
      return 'SOLD';
    case 'DEMO':
      return 'DEMO';
    default:
      return 'FRESH_STOCK';
  }
}

function mapLegacyToVehicleStatus(legacyStatus, pdiStatus) {
  if (legacyStatus === 'IN_TRANSIT') {
    if (pdiStatus === 'YARD_PENDING') return 'PDI_PENDING';
    return 'IN_TRANSIT';
  }
  if (legacyStatus === 'FRESH_STOCK') return 'AVAILABLE';
  if (legacyStatus === 'RESERVED') return 'RESERVED';
  if (legacyStatus === 'SOLD') return 'DELIVERED';
  if (legacyStatus === 'DEMO') return 'DEMO';
  return 'AVAILABLE';
}

function computeAgeingBucket(grnDate, buckets = AGEING_BUCKETS) {
  if (!grnDate) return null;
  const days = Math.floor((Date.now() - new Date(grnDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 15) return buckets[0] || '0-15';
  if (days <= 30) return buckets[1] || '16-30';
  if (days <= 45) return buckets[2] || '31-45';
  if (days <= 60) return buckets[3] || '46-60';
  if (days <= 90) return buckets[4] || '61-90';
  return buckets[5] || '90+';
}

function computeStockAgeDays(grnDate) {
  if (!grnDate) return 0;
  return Math.floor((Date.now() - new Date(grnDate).getTime()) / (1000 * 60 * 60 * 24));
}

function compareConfig(expected, actual) {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const match =
    norm(expected.model) === norm(actual.model) &&
    (!expected.variant || norm(expected.variant) === norm(actual.variant)) &&
    (!expected.colour || norm(expected.colour) === norm(actual.colour)) &&
    (!expected.batteryConfig || norm(expected.batteryConfig) === norm(actual.batteryConfig));
  return match ? 'MATCH' : 'MISMATCH';
}

function assertNotOnHold(stock) {
  if (stock.holdStatus) {
    throw new ApiError(400, `VIN ${stock.vinNo} is on hold (${stock.holdReason || 'unknown'})`);
  }
}

function assertAvailableForAllocation(stock) {
  assertNotOnHold(stock);
  const status = stock.vehicleStatus || stock.status;
  if (status !== 'AVAILABLE' && status !== 'FRESH_STOCK') {
    throw new ApiError(400, `VIN ${stock.vinNo} is not available for allocation (status: ${status})`);
  }
}

module.exports = {
  canTransitionPo,
  canTransitionVehicle,
  assertPoTransition,
  assertVehicleTransition,
  transitionVehicleStatus,
  mapVehicleStatusToLegacy,
  mapLegacyToVehicleStatus,
  computeAgeingBucket,
  computeStockAgeDays,
  compareConfig,
  assertNotOnHold,
  assertAvailableForAllocation,
};
