const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customerId: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  dateOfBirth: { type: Date },
  profileComplete: { type: Boolean, default: false },
  otp: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  otpAttempts: { type: Number, default: 0, select: false },
  isVerified: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  totalTestDrives: { type: Number, default: 0 },
  lastTestDriveAt: { type: Date }
}, { timestamps: true });

CustomerSchema.pre('save', function (next) {
  if (!this.customerId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.customerId = `CUST-${ts}-${rand}`;
  }
  next();
});

module.exports = mongoose.model('Customer', CustomerSchema);
