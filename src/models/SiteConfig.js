const mongoose = require('mongoose');

const siteConfigSchema = new mongoose.Schema(
  {
    heroTagline: { type: String, trim: true },
    leadStripTitle: { type: String, trim: true },
    leadStripSubtitle: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    vf7Price: { type: String, trim: true },
    vf6Price: { type: String, trim: true },
    mpv7Price: { type: String, trim: true },
    vf7Range: { type: String, trim: true },
    vf6Range: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
