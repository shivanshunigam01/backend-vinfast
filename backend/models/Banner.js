const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  title: { type: String },
  subtitle: { type: String },
  imageUrl: { type: String },
  link: { type: String },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
