/**
 * Staff forgot-password via WhatsApp OTP (Employee portal only).
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const TDStaff = require('../models/TDStaff');
const WhatsappOtpChallenge = require('../models/WhatsappOtpChallenge');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { sendOtpViaAisensy } = require('../utils/aisensyCampaign');

const OTP_TTL_MS = Number(process.env.WHATSAPP_OTP_CODE_TTL_MS || 10 * 60 * 1000);
const MAX_VERIFY_ATTEMPTS = Number(process.env.WHATSAPP_OTP_MAX_ATTEMPTS || 5);
const RESEND_COOLDOWN_MS = Number(process.env.WHATSAPP_OTP_RESEND_COOLDOWN_MS || 60 * 1000);
const LOCK_MS = Number(process.env.WHATSAPP_OTP_LOCK_MS || 15 * 60 * 1000);
const RESET_TOKEN_EXPIRES =
  process.env.STAFF_PASSWORD_RESET_TOKEN_EXPIRES_IN?.trim() ||
  process.env.WHATSAPP_OTP_TOKEN_EXPIRES_IN?.trim() ||
  '15m';

const PURPOSE = 'staff_password_reset';

function isOtpEnabled() {
  return process.env.WHATSAPP_OTP_ENABLED === 'true';
}

function hashOtp(mobile10, code) {
  const secret = process.env.JWT_SECRET || 'fallback';
  return crypto.createHmac('sha256', secret).update(`${PURPOSE}:${mobile10}:${code}`).digest('hex');
}

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function normalizeMobile10(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return d;
}

function challengeKey(mobile10) {
  // Namespace staff reset OTPs so they don't collide with customer OTP rows.
  return `staff:${mobile10}`;
}

function issueResetToken(staffId, mobile) {
  return jwt.sign(
    { purpose: PURPOSE, staffId: String(staffId), mobile },
    process.env.JWT_SECRET,
    { expiresIn: RESET_TOKEN_EXPIRES },
  );
}

exports.sendOtp = asyncHandler(async (req, res) => {
  if (!isOtpEnabled()) {
    throw new ApiError(503, 'WhatsApp OTP is not enabled on this server.');
  }

  const mobile = normalizeMobile10(req.body?.mobile);
  if (!mobile) {
    throw new ApiError(400, 'Valid 10-digit WhatsApp mobile number is required');
  }

  const staff = await TDStaff.findOne({ mobile, active: true });
  if (!staff) {
    throw new ApiError(
      400,
      'No active employee account found for this WhatsApp number. Ask an admin to register your mobile in User Master.',
    );
  }

  const key = challengeKey(mobile);
  const existing = await WhatsappOtpChallenge.findOne({ mobile: key });
  if (existing?.otpSentAt) {
    const elapsed = Date.now() - new Date(existing.otpSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new ApiError(429, `Please wait ${retryAfterSec}s before requesting a new code.`);
    }
  }

  const otp = String(crypto.randomInt(1000, 10000));
  const codeHash = hashOtp(mobile, otp);
  const sentAt = new Date();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await WhatsappOtpChallenge.findOneAndUpdate(
    { mobile: key },
    {
      codeHash,
      expiresAt,
      otpSentAt: sentAt,
      verifiedAt: null,
      verifyAttempts: 0,
      lockedUntil: null,
    },
    { upsert: true, new: true },
  );

  try {
    await sendOtpViaAisensy({
      mobile10: mobile,
      displayName: staff.name || 'Employee',
      otpCode: otp,
    });
  } catch (e) {
    await WhatsappOtpChallenge.deleteOne({ mobile: key });
    console.error('[staff-forgot] WA OTP send failed:', e.message);
    const verbose = process.env.AISENSY_VERBOSE_ERRORS === 'true';
    throw new ApiError(
      502,
      verbose ? `WhatsApp send failed: ${e.message}` : 'Could not send WhatsApp message. Try again shortly.',
    );
  }

  return successResponse(
    res,
    {
      sent: true,
      mobileMasked: `${mobile.slice(0, 2)}******${mobile.slice(-2)}`,
      resendCooldownSec: Math.ceil(RESEND_COOLDOWN_MS / 1000),
      maxAttempts: MAX_VERIFY_ATTEMPTS,
    },
    'OTP sent on WhatsApp',
  );
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  if (!isOtpEnabled()) {
    throw new ApiError(503, 'WhatsApp OTP is not enabled on this server.');
  }

  const mobile = normalizeMobile10(req.body?.mobile);
  const rawCode = String(req.body?.code || '').replace(/\D/g, '');
  if (!mobile) throw new ApiError(400, 'Valid mobile number is required');
  if (rawCode.length !== 4) throw new ApiError(400, 'Enter the 4-digit OTP from WhatsApp');

  const staff = await TDStaff.findOne({ mobile, active: true });
  if (!staff) {
    throw new ApiError(400, 'No active employee account found for this WhatsApp number.');
  }

  const key = challengeKey(mobile);
  const doc = await WhatsappOtpChallenge.findOne({ mobile: key });
  if (!doc || !doc.codeHash) {
    throw new ApiError(400, 'No active code for this number. Request a new OTP.');
  }

  if (doc.lockedUntil && new Date(doc.lockedUntil).getTime() > Date.now()) {
    throw new ApiError(429, 'Too many incorrect attempts. Request a new code to continue.');
  }

  if (doc.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'Code expired. Request a new OTP.');
  }

  if (doc.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
    doc.lockedUntil = new Date(Date.now() + LOCK_MS);
    await doc.save();
    throw new ApiError(429, 'Too many incorrect attempts. Request a new code to continue.');
  }

  const expected = doc.codeHash;
  const actual = hashOtp(mobile, rawCode);
  if (!timingSafeEqualHex(expected, actual)) {
    doc.verifyAttempts += 1;
    const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - doc.verifyAttempts);
    if (doc.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      doc.lockedUntil = new Date(Date.now() + LOCK_MS);
    }
    await doc.save();
    throw new ApiError(
      remaining > 0 ? 400 : 429,
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Request a new code to continue.',
    );
  }

  await WhatsappOtpChallenge.findOneAndUpdate(
    { mobile: key },
    {
      $unset: { codeHash: 1 },
      $set: {
        verifiedAt: new Date(),
        verifyAttempts: 0,
        lockedUntil: null,
      },
    },
  );

  const resetToken = issueResetToken(staff._id, mobile);
  return successResponse(res, { resetToken }, 'OTP verified');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const resetToken = String(req.body?.resetToken || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!resetToken) throw new ApiError(400, 'Reset token is required');
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }

  let payload;
  try {
    payload = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(400, 'Reset session expired. Verify OTP again.');
  }

  if (payload?.purpose !== PURPOSE || !payload.staffId || !payload.mobile) {
    throw new ApiError(400, 'Invalid reset session');
  }

  const staff = await TDStaff.findById(payload.staffId).select('+password +passwordPlain');
  if (!staff || !staff.active) {
    throw new ApiError(400, 'Employee account not found or inactive');
  }
  if (String(staff.mobile || '') !== String(payload.mobile)) {
    throw new ApiError(400, 'Mobile number no longer matches this account');
  }

  staff.password = newPassword;
  staff.markModified('password');
  await staff.save();

  return successResponse(res, { ok: true }, 'Password updated. You can sign in now.');
});
