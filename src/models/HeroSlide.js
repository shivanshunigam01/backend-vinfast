const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    badge: { type: String, trim: true },
    ctaPrimary: { type: String, trim: true },
    ctaSecondary: { type: String, trim: true },
    ctaPrimaryLink: { type: String, trim: true },
    ctaSecondaryLink: { type: String, trim: true },
    bgImage: { type: String, required: true, trim: true },
    bgImageMobile: { type: String, trim: true, default: '' },
    objectPosition: { type: String, trim: true, default: 'center 50%' },
    objectPositionMobile: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HeroSlide', heroSlideSchema);
