const mongoose = require('mongoose');

const colorVariantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    hex: { type: String },
    image: { type: String },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    tagline: { type: String, trim: true },
    priceFrom: { type: String, trim: true },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    specs: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    heroImage: { type: String, trim: true },
    galleryImages: [{ type: String }],
    colorVariants: [colorVariantSchema],
    brochureUrl: { type: String, trim: true },
    seo: {
      metaTitle: { type: String, trim: true },
      metaDescription: { type: String, trim: true },
      keywords: [{ type: String, trim: true }],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
