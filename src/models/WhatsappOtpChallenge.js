const mongoose = require('mongoose');

/**
 * One document per 10-digit mobile.
 * - Wrong OTP attempts NEVER mint a new code — only explicit /send does.
 * - After max attempts, lockedUntil is set; customer must explicitly request a new OTP.
 */
const whatsappOtpChallengeSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, trim: true, index: true },
    codeHash: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    otpSentAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verifyAttempts: { type: Number, default: 0 },
    /** When set and in the future, verify is blocked until customer requests a new OTP. */
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

whatsappOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('WhatsappOtpChallenge', whatsappOtpChallengeSchema);
