const mongoose = require('mongoose');

const MODEL_PAGE_SLUGS = ['vf6', 'vf7', 'mpv7'];

const modelPageFeatureSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, trim: true, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    alt: { type: String, trim: true, default: '' },
    /** wide = 2-column hero cards; standard = 3-column detail cards */
    layout: { type: String, enum: ['wide', 'standard'], default: 'standard' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: true },
);

const modelPageContentSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      enum: MODEL_PAGE_SLUGS,
    },
    galleryLabel: { type: String, trim: true, default: 'Gallery' },
    galleryTitle: { type: String, trim: true, default: '' },
    galleryIntro: { type: String, trim: true, default: '' },
    features: { type: [modelPageFeatureSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ModelPageContent', modelPageContentSchema);
module.exports.MODEL_PAGE_SLUGS = MODEL_PAGE_SLUGS;
