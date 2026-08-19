const mongoose = require('mongoose');

const leadFavouriteSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', required: true, index: true },
  },
  { timestamps: true },
);

leadFavouriteSchema.index({ leadId: 1, staffId: 1 }, { unique: true });
leadFavouriteSchema.index({ staffId: 1, createdAt: -1 });

module.exports = mongoose.model('LeadFavourite', leadFavouriteSchema);
