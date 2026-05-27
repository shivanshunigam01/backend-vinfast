const mongoose = require('mongoose');
const { leadStatuses, productModels } = require('../constants/enums');

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, required: true, trim: true },
    otherCity: { type: String, trim: true },
    model: { type: String, enum: productModels, required: true },
    interest: { type: String, trim: true },
    source: { type: String, trim: true, default: 'Website' },
    status: { type: String, enum: leadStatuses, default: 'New Lead' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    nextFollowUp: { type: Date },
    remarks: { type: String, trim: true },
    financeNeeded: { type: Boolean, default: false },
    exchangeNeeded: { type: Boolean, default: false },
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    pageSource: String,
    // Used for de-dup/upsert when leads come from external providers (e.g. Meta webhook).
    metaUniqueId: { type: String, index: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
