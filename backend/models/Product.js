const mongoose = require('mongoose');

const ColorVariantSchema = new mongoose.Schema({
  name: { type: String },
  hex: { type: String },
  image: { type: String }
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  tagline: { type: String },
  priceFrom: { type: String },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  specs: {
    range: String,
    battery: String,
    power: String,
    torque: String,
    topSpeed: String,
    driveType: String,
    fastCharge: String,
    homeCharge: String,
    safety: String,
    airbags: String,
    adas: String,
    touchscreen: String,
    bootSpace: String,
    variants: String
  },
  heroImage: { type: String },
  galleryImages: [{ type: String }],
  colorVariants: [ColorVariantSchema],
  brochureUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
