const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false },
);

const vendorSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    type: { type: String, enum: ['OEM', 'TRANSPORTER', 'ACCESSORY', 'OTHER'], default: 'OEM', index: true },
    gstin: { type: String, trim: true },
    pan: { type: String, trim: true },
    address: { type: addressSchema, default: () => ({}) },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    paymentTermsDefault: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    systemProtected: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    logoUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

vendorSchema.index({ active: 1, sortOrder: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
