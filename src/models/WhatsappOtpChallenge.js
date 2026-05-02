const mongoose = require('mongoose');

/** Stores hashed OTP for WhatsApp verification; TTL removes expired rows. */
const whatsappOtpChallengeSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verifyAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

whatsappOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('WhatsappOtpChallenge', whatsappOtpChallengeSchema);
