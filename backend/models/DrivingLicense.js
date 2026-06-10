const mongoose = require('mongoose');

const DrivingLicenseSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  licenseNumber: { type: String, required: true, trim: true, uppercase: true },
  holderName: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, required: true },
  issueDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  issuingAuthority: { type: String, trim: true },
  vehicleClasses: [{ type: String }], // e.g. ['LMV', 'MCWG']
  frontImageUrl: { type: String },
  backImageUrl: { type: String },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected', 'Expired'],
    default: 'Pending'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt: { type: Date },
  rejectionReason: { type: String, trim: true }
}, { timestamps: true });

DrivingLicenseSchema.virtual('isExpired').get(function () {
  return this.expiryDate < new Date();
});

DrivingLicenseSchema.virtual('daysToExpiry').get(function () {
  return Math.floor((this.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('DrivingLicense', DrivingLicenseSchema);
