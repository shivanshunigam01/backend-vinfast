const mongoose = require('mongoose');
const { isValidLeadModel } = require('../utils/leadModel');

const LEAD_SOURCES = [
  'Meta Ads',
  'Google Business Profile',
  'Website',
  'Walk-in',
  'Management Referral',
  'Employee Referral',
  'VinFast India Digital Leads',
  'CarDekho',
  'Zentroverse',
  'WhatsApp',
  'Tele-In',
  'Tele-Out',
  'Event / BTL',
  'Outdoor Activity',
  'Existing Customer Referral',
  'Social Media (YouTube, Facebook, Instagram)',
  // System-generated sources (auto-created leads):
  'Test Drive',
  'Enquiry',
];

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
    assignedToEmail: { type: String, trim: true, lowercase: true, index: true },
    lastActivityAt: { type: Date, index: true },
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
    // Referral tracking — existing customer who referred this lead.
    referredByCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PVCustomer', index: true },
    referredByMobile: { type: String, trim: true },
    // Sale conversion — the actual buyer's customer record (may differ from pvCustomerId).
    convertedCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PVCustomer', index: true },
    convertedAt: { type: Date },
    convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    // Duplicate elimination (MoM #15) — soft-merge markers
    isDuplicate: { type: Boolean, default: false, index: true },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
  },
  { timestamps: true },
);

leadSchema.index({ pvCustomerId: 1, model: 1, status: 1 });
leadSchema.index({ tdBookingId: 1 }, { sparse: true });

module.exports = mongoose.model('Lead', leadSchema);
module.exports.LEAD_SOURCES = LEAD_SOURCES;