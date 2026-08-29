const mongoose = require('mongoose');

const yardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    active: { type: Boolean, default: true },
    zones: [
      {
        name: { type: String, required: true, trim: true },
        code: { type: String, trim: true },
        active: { type: Boolean, default: true },
        bays: [
          {
            name: { type: String, required: true, trim: true },
            code: { type: String, trim: true },
            active: { type: Boolean, default: true },
          },
        ],
      },
    ],
  },
  { _id: true },
);

const stockLocationSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch', required: true, index: true },
    yards: { type: [yardSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

stockLocationSchema.index({ branchId: 1 }, { unique: true });

module.exports = mongoose.model('StockLocation', stockLocationSchema);
