const mongoose = require('mongoose');

const HeroSlideSchema = new mongoose.Schema({
  title: { type: String },
  subtitle: { type: String },
  badge: { type: String },
  ctaPrimary: { type: String },
  ctaPrimaryLink: { type: String },
  ctaSecondary: { type: String },
  ctaSecondaryLink: { type: String },
  bgImage: { type: String },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('HeroSlide', HeroSlideSchema);
