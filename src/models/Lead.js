const mongoose = require('mongoose');
const { isValidLeadModel } = require('../utils/leadModel');

const LEAD_SOURCES = ['Website', 'Meta Ads', 'Test Drive', 'Enquiry', 'Walk-in', 'Executive', 'Referral', 'WhatsApp'];

const leadSchema = new mongoose.Schema(
  {
    leadId: { type: String, unique: true, sparse: true, trim: true, index: true },
    opportunityId: { type: String, unique: true, sparse: true, trim: true, index: true },
    pvCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PVCustomer', index: true },
    subCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PVCustomer' },
    vehicleRegistration: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, required: true, trim: true },
    otherCity: { type: String, trim: true },
    model: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isValidLeadModel,
        message: 'Invalid model',
      },
    },
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
    metaUniqueId: { type: String, index: true, trim: true, sparse: true },
    enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
    testDriveId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestDrive' },
    tdBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' },
  },
  { timestamps: true },
);

leadSchema.index({ pvCustomerId: 1, model: 1, status: 1 });
leadSchema.index({ tdBookingId: 1 }, { sparse: true });

module.exports = mongoose.model('Lead', leadSchema);
module.exports.LEAD_SOURCES = LEAD_SOURCES;