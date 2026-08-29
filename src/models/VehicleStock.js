const mongoose = require('mongoose');
const { VEHICLE_STATUSES } = require('../constants/stockPipeline');

const BATTERY_STATUSES = ['OK', 'CHARGING', 'LOW', 'FAULT'];
const PDI_STATUSES = ['NONE', 'YARD_PENDING', 'YARD_PASSED', 'FINAL_PENDING', 'FINAL_PASSED'];
const LEGACY_STOCK_STATUSES = ['FRESH_STOCK', 'DEMO', 'RESERVED', 'SOLD', 'IN_TRANSIT'];

const vehicleStockSchema = new mongoose.Schema(
  {
    stockId: { type: String, required: true, unique: true, trim: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    variant: { type: String, trim: true },
    colour: { type: String, trim: true },
    interiorColour: { type: String, trim: true },
    batteryConfig: { type: String, trim: true },
    modelYear: { type: Number },
    vinNo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    registrationNo: { type: String, trim: true, uppercase: true },
    motorNo: { type: String, trim: true, uppercase: true },
    motorNo2: { type: String, trim: true, uppercase: true },
    mfgMonthYear: { type: String, trim: true },
    odometerKm: { type: Number, min: 0 },
    grnDate: { type: Date },
    billingDate: { type: Date },
    batteryPercent: { type: Number, min: 0, max: 100, default: 100 },
    lastSoc: { type: Number, min: 0, max: 100 },
    lastChargedDate: { type: Date },
    nextInspectionDue: { type: Date },
    batteryStatus: { type: String, enum: BATTERY_STATUSES, default: 'OK' },
    hvBatteryStatus: { type: String, enum: ['OK', 'WARNING', 'FAULT', 'NOT_CHECKED'], default: 'NOT_CHECKED' },
    location: { type: String, trim: true },
    yardName: { type: String, trim: true },
    zoneName: { type: String, trim: true },
    bayName: { type: String, trim: true },
    /** Spec lifecycle status */
    vehicleStatus: { type: String, enum: VEHICLE_STATUSES, default: 'IN_TRANSIT', index: true },
    /** Legacy status kept for backward compat */
    status: { type: String, enum: LEGACY_STOCK_STATUSES, default: 'IN_TRANSIT', index: true },
    stockAgeDays: { type: Number, default: 0 },
    ageingBucket: { type: String, trim: true },
    holdStatus: { type: Boolean, default: false, index: true },
    holdReason: { type: String, trim: true },
    pdiStatus: { type: String, enum: PDI_STATUSES, default: 'NONE', index: true },
    isDemo: { type: Boolean, default: false, index: true },
    demoVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDVehicle' },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch', index: true },
    grnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grn', index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleOrder', index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    reservationExpiry: { type: Date },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleStock', vehicleStockSchema);
module.exports.VEHICLE_STATUSES = VEHICLE_STATUSES;
module.exports.BATTERY_STATUSES = BATTERY_STATUSES;
module.exports.PDI_STATUSES = PDI_STATUSES;
module.exports.LEGACY_STOCK_STATUSES = LEGACY_STOCK_STATUSES;
