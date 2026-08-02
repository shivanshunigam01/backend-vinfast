const mongoose = require('mongoose');

const ALLOWED_SLUGS = ['vf6', 'vf7', 'mpv7', 'limo-green'];

const variantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    price: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const vehiclePricingSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      enum: ALLOWED_SLUGS,
    },
    name: { type: String, trim: true, default: '' },
    priceFrom: { type: String, trim: true, default: '' },
    range: { type: String, trim: true, default: '' },
    variants: { type: [variantSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

vehiclePricingSchema.index({ active: 1, slug: 1 });

module.exports = mongoose.model('VehiclePricing', vehiclePricingSchema);
module.exports.ALLOWED_SLUGS = ALLOWED_SLUGS;
