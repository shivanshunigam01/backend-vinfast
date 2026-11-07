const mongoose = require('mongoose');

const MARKETING_PAGE_SLUGS = ['compare', 'test-drive', 'emi-calculator', 'about', 'contact'];

const marketingPageContentSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      enum: MARKETING_PAGE_SLUGS,
    },
    hero: {
      imageUrl: { type: String, trim: true, default: '' },
      width: { type: Number, default: 3840 },
      height: { type: Number, default: 2160 },
      alt: { type: String, trim: true, default: '' },
      imageFit: { type: String, enum: ['cover', 'contain'], default: 'cover' },
      objectPosition: { type: String, trim: true, default: 'center center' },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('MarketingPageContent', marketingPageContentSchema);
module.exports.MARKETING_PAGE_SLUGS = MARKETING_PAGE_SLUGS;
