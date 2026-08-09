const mongoose = require('mongoose');

const PDI_TYPES = ['YARD', 'FINAL'];
const PDI_RESULTS = ['PASS', 'FAIL'];

const checklistItemSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true },
    label: { type: String, trim: true },
    ok: { type: Boolean, default: true },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const stockPdiSchema = new mongoose.Schema(
  {
    type: { type: String, enum: PDI_TYPES, required: true, index: true },
    result: { type: String, enum: PDI_RESULTS, required: true },
    vehicleStockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleStock',
      required: true,
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleOrder', index: true },
    checklist: { type: [checklistItemSchema], default: [] },
    notes: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    performedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model('StockPdi', stockPdiSchema);
module.exports.PDI_TYPES = PDI_TYPES;
module.exports.PDI_RESULTS = PDI_RESULTS;
