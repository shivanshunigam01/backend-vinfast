const mongoose = require('mongoose');
const { productModels } = require('../constants/enums');

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
    status: { type: String, trim: true, default: 'Enquiry' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    nextFollowUp: { type: Date },
    remarks: { type: String, trim: true },
    financeNeeded: { type: Boolean, default: false },
    exchangeNeeded: { type: Boolean, default: false },
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    pageSource: String,
    metaUniqueId: { type: String, index: true, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Lead', leadSchema);
