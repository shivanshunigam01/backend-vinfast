const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false },
);

const grnItemSchema = new mongoose.Schema(
  {
    vin: { type: String, required: true, trim: true, uppercase: true },
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', index: true },
    physicalModel: { type: String, trim: true },
    physicalVariant: { type: String, trim: true },
    physicalColour: { type: String, trim: true },
    matchResult: { type: String, enum: ['MATCH', 'MISMATCH'], default: 'MATCH' },
    odometerKm: { type: Number, min: 0 },
    exteriorCondition: { type: mongoose.Schema.Types.Mixed },
    photos: { type: [photoSchema], default: [] },
    exceptionType: { type: String, trim: true },
    exceptionStatus: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'OEM_CLAIM', 'TRANSPORT_CLAIM', 'RESOLVED', 'REJECTED'],
    },
    exceptionRemark: { type: String, trim: true },
  },
  { _id: true },
);

const grnSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, unique: true, trim: true, index: true },
    grnDatetime: { type: Date, required: true },
    gateEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'GateEntry', index: true },
    dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch', required: true, index: true },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    poNumber: { type: String, trim: true },
    invoiceNumber: { type: String, required: true, trim: true },
    expectedQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
    status: { type: String, enum: ['RECEIVED', 'EXCEPTION', 'CLOSED'], default: 'RECEIVED', index: true },
    items: { type: [grnItemSchema], default: [] },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    remarks: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Grn', grnSchema);
