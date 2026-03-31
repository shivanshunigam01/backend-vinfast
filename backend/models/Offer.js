const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  model: { type: String, default: 'All Models' },
  type: { type: String, enum: ['Launch', 'Exchange', 'Finance', 'Accessory', 'Seasonal', 'Other'], default: 'Launch' },
  validTill: { type: Date },
  active: { type: Boolean, default: true },
  imageUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Offer', OfferSchema);
