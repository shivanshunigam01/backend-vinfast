const mongoose = require('mongoose');

const MediaItemSchema = new mongoose.Schema({
  name: { type: String },
  url: { type: String, required: true },
  publicId: { type: String },
  tag: { type: String, default: 'Other' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('MediaItem', MediaItemSchema);
