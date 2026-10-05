const mongoose = require('mongoose');

const offerMediaTypes = ['image', 'video', 'gif'];

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    model: { type: String, trim: true },
    type: { type: String, trim: true },
    validTill: { type: Date },
    /** Image, video, or GIF URL (Cloudinary or external). */
    imageUrl: { type: String, trim: true },
    mediaType: { type: String, enum: offerMediaTypes, default: 'image' },
    ctaLabel: { type: String, trim: true },
    ctaLink: { type: String, trim: true },
    displayOrder: { type: Number, default: 0 },
    /** When true, offer is returned on the public homepage API. */
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Offer', offerSchema);
