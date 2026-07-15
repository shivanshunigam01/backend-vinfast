const mongoose = require('mongoose');

const STOCK_STATUSES = ['FRESH_STOCK', 'DEMO', 'RESERVED', 'SOLD', 'IN_TRANSIT'];
const BATTERY_STATUSES = ['OK', 'CHARGING', 'LOW', 'FAULT'];

/**
 * Dealer stock register. A stock unit can be tagged as a demo vehicle, which
 * creates/links a TDVehicle so it becomes usable in the test-drive module.
 */
const vehicleStockSchema = new mongoose.Schema(
  {
    stockId: { type: String, required: true, unique: true, trim: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    variant: { type: String, trim: true },
    colour: { type: String, trim: true },
    vinNo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    registrationNo: { type: String, trim: true, uppercase: true },
    batteryPercent: { type: Number, min: 0, max: 100, default: 100 },
    batteryStatus: { type: String, enum: BATTERY_STATUSES, default: 'OK' },
    location: { type: String, trim: true },
    status: { type: String, enum: STOCK_STATUSES, default: 'FRESH_STOCK', index: true },
    isDemo: { type: Boolean, default: false, index: true },
    demoVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDVehicle' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleStock', vehicleStockSchema);
module.exports.STOCK_STATUSES = STOCK_STATUSES;
module.exports.BATTERY_STATUSES = BATTERY_STATUSES;
