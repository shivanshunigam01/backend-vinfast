const mongoose = require('mongoose');

const MODEL_PAGE_SLUGS = ['vf6', 'vf7', 'mpv7', 'limo-green'];

const modelPageColorShadeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hex: { type: String, trim: true, default: '#888888' },
    imageUrl: { type: String, trim: true, default: '' },
    alt: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: true },
);

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
    colorStudioIntro: { type: String, trim: true, default: '' },
    colorShades: { type: [modelPageColorShadeSchema], default: [] },
    features: { type: [modelPageFeatureSchema], default: [] },
    hero: {
      imageUrl: { type: String, trim: true, default: '' },
      width: { type: Number, default: 3840 },
      height: { type: Number, default: 2160 },
      alt: { type: String, trim: true, default: '' },
      imageFit: { type: String, enum: ['cover', 'contain'], default: 'cover' },
      showcaseOnHomepage: { type: Boolean, default: false },
      homepageHeroOrder: { type: Number, default: 10 },
      homepageHeroTitle: { type: String, trim: true, default: '' },
      homepageHeroSubtitle: { type: String, trim: true, default: '' },
      homepageHeroBadge: { type: String, trim: true, default: '' },
      homepageObjectPosition: { type: String, trim: true, default: 'center center' },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ModelPageContent', modelPageContentSchema);
module.exports.MODEL_PAGE_SLUGS = MODEL_PAGE_SLUGS;
