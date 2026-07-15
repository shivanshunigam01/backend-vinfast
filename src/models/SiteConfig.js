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
    limoGreenPrice: { type: String, trim: true },
    vf7Range: { type: String, trim: true },
    vf6Range: { type: String, trim: true },
    // Site-wide SEO defaults (served via GET /public/seo/global).
    defaultMetaTitle: { type: String, trim: true },
    defaultMetaDescription: { type: String, trim: true },
    // Google Search Console verification token (content of the meta tag).
    googleSiteVerification: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
