const mongoose = require('mongoose');

const dispatchItemSchema = new mongoose.Schema(
  {
    vin: { type: String, required: true, trim: true, uppercase: true },
    model: { type: String, required: true, trim: true },
    variant: { type: String, trim: true },
    colour: { type: String, trim: true },
    batteryConfig: { type: String, trim: true },
    mfgMonthYear: { type: String, trim: true },
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock' },
    poLineId: { type: mongoose.Schema.Types.ObjectId },
    configMatch: { type: String, enum: ['MATCH', 'MISMATCH', 'PENDING'], default: 'PENDING' },
  },
  { _id: true },
);

const dispatchSchema = new mongoose.Schema(
  {
    dispatchNumber: { type: String, required: true, unique: true, trim: true, index: true },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
    poNumber: { type: String, trim: true },
    oemInvoiceNumber: { type: String, required: true, trim: true },
    oemInvoiceDate: { type: Date, required: true },
    dispatchDate: { type: Date, required: true },
    transporter: { type: String, required: true, trim: true },
    lrNumber: { type: String, required: true, trim: true },
    truckNumber: { type: String, required: true, trim: true },
    driverName: { type: String, trim: true },
    driverMobile: { type: String, trim: true },
    ewayBill: { type: String, trim: true },
    expectedArrival: { type: Date },
    status: { type: String, enum: ['IN_TRANSIT', 'ARRIVED', 'CLOSED'], default: 'IN_TRANSIT', index: true },
    items: { type: [dispatchItemSchema], default: [] },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    remarks: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Dispatch', dispatchSchema);
