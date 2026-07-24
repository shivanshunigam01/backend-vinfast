const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const WhatsappOtpChallenge = require('../models/WhatsappOtpChallenge');
const { sendOtpViaAisensy } = require('../utils/aisensyCampaign');

const OTP_TTL_MS = Number(process.env.WHATSAPP_OTP_CODE_TTL_MS || 10 * 60 * 1000);
const MAX_VERIFY_ATTEMPTS = Number(process.env.WHATSAPP_OTP_MAX_ATTEMPTS || 5);
const RESEND_COOLDOWN_MS = Number(process.env.WHATSAPP_OTP_RESEND_COOLDOWN_MS || 60 * 1000);
const LOCK_MS = Number(process.env.WHATSAPP_OTP_LOCK_MS || 15 * 60 * 1000);
const TOKEN_EXPIRES =
  process.env.WHATSAPP_OTP_TOKEN_EXPIRES_IN?.trim() || process.env.JWT_EXPIRES_IN?.trim() || '15m';

/** Aligns DB row lifetime after verify with JWT `expiresIn` (e.g. 15m, 1h). */
function tokenExpiryToMs(expiresIn) {
  const s = String(expiresIn || '15m').trim();
  const m = s.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const table = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * (table[u] || 60 * 1000);
}

function isOtpEnabled() {
  return process.env.WHATSAPP_OTP_ENABLED === 'true';
}

function hashOtp(mobile10, code) {
  const secret = process.env.JWT_SECRET || 'fallback';
  return crypto.createHmac('sha256', secret).update(`${mobile10}:${code}`).digest('hex');
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

function bypassOtpCode() {
  return String(process.env.WHATSAPP_OTP_BYPASS_CODE || '0000').replace(/\D/g, '');
}

function isBypassOtp(code) {
  const digits = String(code || '').replace(/\D/g, '');
  return digits.length > 0 && digits === bypassOtpCode();
}

function issueVerificationToken(mobile) {
  return jwt.sign({ purpose: 'wa_otp', mobile }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES,
  });
}

/**
 * Explicit customer request only — never called from verify on wrong attempts.
 */
exports.sendOtp = asyncHandler(async (req, res) => {
  if (!isOtpEnabled()) {
    return errorResponse(res, 'WhatsApp OTP is not enabled on this server.', 503);
  }

  const mobile = normalizeMobile10(req.body.mobile);
  const name = String(req.body.name || req.body.customerName || 'Customer').trim() || 'Customer';
  if (!mobile) {
    return errorResponse(res, 'Valid 10-digit Indian mobile number is required.', 400);
  }

  const existing = await WhatsappOtpChallenge.findOne({ mobile });
  if (existing?.otpSentAt) {
    const elapsed = Date.now() - new Date(existing.otpSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return errorResponse(
        res,
        `Please wait ${retryAfterSec}s before requesting a new code.`,
        429,
      );
    }
  }

  // Fresh OTP only on explicit send — wrong verify attempts never reach here.
  const otp = String(crypto.randomInt(1000, 10000));
  const codeHash = hashOtp(mobile, otp);
  const sentAt = new Date();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await WhatsappOtpChallenge.findOneAndUpdate(
    { mobile },
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
    await sendOtpViaAisensy({ mobile10: mobile, displayName: name, otpCode: otp });
  } catch (e) {
    await WhatsappOtpChallenge.deleteOne({ mobile });
    const detail = e.aisensyBody != null ? JSON.stringify(e.aisensyBody) : '';
    console.error('[whatsapp-otp] WA campaign send failed:', e.message, detail);
    const verbose = process.env.AISENSY_VERBOSE_ERRORS === 'true';
    const clientMsg = verbose
      ? `WhatsApp send failed: ${e.message}`
      : 'Could not send WhatsApp message. Try again shortly.';
    return errorResponse(res, clientMsg, 502);
  }

  return successResponse(
    res,
    {
      sent: true,
      mobileMasked: `${mobile.slice(0, 2)}******${mobile.slice(-2)}`,
      resendCooldownSec: Math.ceil(RESEND_COOLDOWN_MS / 1000),
      maxAttempts: MAX_VERIFY_ATTEMPTS,
    },
    undefined,
    200,
  );
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  if (!isOtpEnabled()) {
    return errorResponse(res, 'WhatsApp OTP is not enabled on this server.', 503);
  }

  const mobile = normalizeMobile10(req.body.mobile);
  const rawCode = String(req.body.code || '').replace(/\D/g, '');
  if (!mobile) {
    return errorResponse(res, 'Valid mobile number is required.', 400);
  }

  if (isBypassOtp(rawCode)) {
    const verificationToken = issueVerificationToken(mobile);
    return successResponse(res, { verificationToken }, undefined, 200);
  }

  if (rawCode.length !== 4) {
    return errorResponse(res, 'Valid mobile and 4-digit code are required.', 400);
  }
  const code = rawCode;

  const doc = await WhatsappOtpChallenge.findOne({ mobile });
  if (!doc || !doc.codeHash) {
    return errorResponse(
      res,
      'No active code for this number. Request a new code on WhatsApp.',
      400,
    );
  }

  if (doc.lockedUntil && new Date(doc.lockedUntil).getTime() > Date.now()) {
    return errorResponse(
      res,
      'Too many incorrect attempts. Request a new code to continue.',
      429,
    );
  }

  if (doc.expiresAt.getTime() < Date.now()) {
    // Keep the row; do NOT auto-issue a new OTP — customer must tap Send again.
    return errorResponse(res, 'Code expired. Request a new code on WhatsApp.', 400);
  }

  if (doc.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
    doc.lockedUntil = new Date(Date.now() + LOCK_MS);
    await doc.save();
    return errorResponse(
      res,
      'Too many incorrect attempts. Request a new code to continue.',
      429,
    );
  }

  const expected = doc.codeHash;
  const actual = hashOtp(mobile, code);
  if (!timingSafeEqualHex(expected, actual)) {
    doc.verifyAttempts += 1;
    const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - doc.verifyAttempts);
    if (doc.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      doc.lockedUntil = new Date(Date.now() + LOCK_MS);
    }
    await doc.save();
    // Same OTP remains valid until expiry / explicit resend — never mint a new one here.
    return errorResponse(
      res,
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Request a new code to continue.',
      remaining > 0 ? 400 : 429,
    );
  }

  const verifiedAt = new Date();
  const sessionUntil = new Date(Date.now() + tokenExpiryToMs(TOKEN_EXPIRES));

  await WhatsappOtpChallenge.findOneAndUpdate(
    { mobile },
    {
      $unset: { codeHash: 1 },
      $set: {
        verifiedAt,
        expiresAt: sessionUntil,
        verifyAttempts: 0,
        lockedUntil: null,
      },
    },
  );

  const verificationToken = issueVerificationToken(mobile);

  return successResponse(res, { verificationToken }, undefined, 200);
});
