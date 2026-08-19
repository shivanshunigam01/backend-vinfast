const mongoose = require('mongoose');
const { isValidLeadModel } = require('../utils/leadModel');

/** Legacy rows may still store "Both"; new writes should use a single model. */
function isAcceptableStoredLeadModel(value) {
  const s = String(value || '').trim();
  return isValidLeadModel(s) || s === 'Both';
}

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
    /** Area / locality used by CRE when routing leads to executives. */
    area: { type: String, trim: true, index: true },
    /** Free-text address / landmark for executive follow-up. */
    address: { type: String, trim: true },
    /**
     * CRE lead classification (HOT / WARM / COLD / FOLLOW-UP / NOT CONNECTED / LOST).
     * Separate from CRM pipeline `status`.
     */
    leadType: { type: String, trim: true, index: true },
    /** Staff who created / imported the lead (typically CRE). */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', index: true },
    model: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isAcceptableStoredLeadModel,
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
    /** Configurable buyer type (Individual / Corporate / …) from Buyer Type master. */
    buyerType: { type: String, trim: true, index: true },
    /** Sales interest from follow-up discipline (HOT / WARM / COLD). Separate from CRE leadType. */
    interestLevel: { type: String, trim: true, index: true },
    /** First valid CRM action after lead received (follow-up logged or stage moved off Enquiry). */
    firstRespondedAt: { type: Date },
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
    /**
     * Snapshot of CRE "Current Format" Excel columns that are not first-class
     * CRM fields (TD / booking / retail / sales-person activity). Import-only;
     * does not create TDBooking or sale records.
     */
    creSheet: {
      enquiryDate: { type: Date },
      callDate: { type: Date },
      existingVariant: { type: String, trim: true },
      salesConsultantName: { type: String, trim: true },
      salesPersonDate: { type: Date },
      salesPersonRemark: { type: String, trim: true },
      tdDate: { type: Date },
      tdDone: { type: Boolean },
      tdNotDoneWhy: { type: String, trim: true },
      afterTdRemark: { type: String, trim: true },
      bookingDone: { type: Boolean },
      bookingDate: { type: Date },
      finalModel: { type: String, trim: true },
      finalVariant: { type: String, trim: true },
      finalColour: { type: String, trim: true },
      mailSent: { type: Boolean },
      retailDone: { type: Boolean },
      retailDate: { type: Date },
      deliveryDate: { type: Date },
      initialRemark: { type: String, trim: true },
    },
  },
  { timestamps: true },
);

leadSchema.index({ pvCustomerId: 1, model: 1, status: 1 });
leadSchema.index({ tdBookingId: 1 }, { sparse: true });
leadSchema.index({ createdBy: 1, createdAt: -1 });
leadSchema.index({ area: 1, leadType: 1, assignedTo: 1 });

module.exports = mongoose.model('Lead', leadSchema);
module.exports.LEAD_SOURCES = LEAD_SOURCES;