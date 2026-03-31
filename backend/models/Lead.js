const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  city: { type: String, trim: true },
  otherCity: { type: String, trim: true },
  model: { type: String, enum: ['VF 6', 'VF 7', 'Both'], required: true },
  interest: { type: String, enum: ['Test Drive', 'Price Enquiry', 'Finance', 'General'], default: 'Test Drive' },
  source: { type: String, enum: ['Website', 'Google Ads', 'Meta Ads', 'WhatsApp', 'Walk-in', 'Referral'], default: 'Website' },
  status: { type: String, enum: ['New Lead', 'Contact Attempted', 'Interested', 'Negotiation', 'Booked', 'Delivered', 'Lost', 'Not Interested'], default: 'New Lead' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  nextFollowUp: { type: Date },
  remarks: { type: String, trim: true },
  financeNeeded: { type: Boolean, default: false },
  exchangeNeeded: { type: Boolean, default: false },
  utmSource: { type: String },
  utmMedium: { type: String },
  utmCampaign: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Lead', LeadSchema);
