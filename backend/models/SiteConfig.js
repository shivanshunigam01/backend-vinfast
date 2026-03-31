const mongoose = require('mongoose');

const SiteConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('SiteConfig', SiteConfigSchema);
