const mongoose = require('mongoose');

const buyerTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    systemProtected: { type: Boolean, default: false },
  },
  { timestamps: true },
);

buyerTypeSchema.index({ order: 1 });
buyerTypeSchema.index({ active: 1, order: 1 });

module.exports = mongoose.model('BuyerType', buyerTypeSchema);
