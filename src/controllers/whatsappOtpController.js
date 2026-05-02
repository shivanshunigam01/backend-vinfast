const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const WhatsappOtpChallenge = require('../models/WhatsappOtpChallenge');
const { sendOtpViaAisensy } = require('../utils/aisensyCampaign');

const OTP_TTL_MS = Number(process.env.WHATSAPP_OTP_CODE_TTL_MS || 10 * 60 * 1000);
const MAX_VERIFY_ATTEMPTS = Number(process.env.WHATSAPP_OTP_MAX_ATTEMPTS || 6);
const TOKEN_EXPIRES =
  process.env.WHATSAPP_OTP_TOKEN_EXPIRES_IN?.trim() || process.env.JWT_EXPIRES_IN?.trim() || '15m';

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

exports.sendOtp = asyncHandler(async (req, res) => {
  if (!isOtpEnabled()) {
    return errorResponse(res, 'WhatsApp OTP is not enabled on this server.', 503);
  }

  const mobile = normalizeMobile10(req.body.mobile);
  const name = String(req.body.name || req.body.customerName || 'Customer').trim() || 'Customer';
  if (!mobile) {
    return errorResponse(res, 'Valid 10-digit Indian mobile number is required.', 400);
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashOtp(mobile, otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await WhatsappOtpChallenge.findOneAndUpdate(
    { mobile },
    { codeHash, expiresAt, verifyAttempts: 0 },
    { upsert: true, new: true }
  );

  try {
    await sendOtpViaAisensy({ mobile10: mobile, displayName: name, otpCode: otp });
  } catch (e) {
    await WhatsappOtpChallenge.deleteOne({ mobile });
    console.error('[whatsapp-otp] AiSensy send failed:', e.message);
    return errorResponse(
      res,
      'Could not send WhatsApp message. Check AISENSY_* configuration or try again shortly.',
      502
    );
  }

  return successResponse(res, { sent: true, mobileMasked: `${mobile.slice(0, 2)}******${mobile.slice(-2)}` }, undefined, 200);
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  if (!isOtpEnabled()) {
    return errorResponse(res, 'WhatsApp OTP is not enabled on this server.', 503);
  }

  const mobile = normalizeMobile10(req.body.mobile);
  const code = String(req.body.code || '').replace(/\D/g, '');
  if (!mobile || code.length !== 6) {
    return errorResponse(res, 'Valid mobile and 6-digit code are required.', 400);
  }

  const doc = await WhatsappOtpChallenge.findOne({ mobile });
  if (!doc || doc.expiresAt.getTime() < Date.now()) {
    return errorResponse(res, 'Code expired or not found. Request a new code on WhatsApp.', 400);
  }

  if (doc.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
    await WhatsappOtpChallenge.deleteOne({ mobile });
    return errorResponse(res, 'Too many attempts. Request a new code.', 429);
  }

  const expected = doc.codeHash;
  const actual = hashOtp(mobile, code);
  if (!timingSafeEqualHex(expected, actual)) {
    doc.verifyAttempts += 1;
    await doc.save();
    return errorResponse(res, 'Incorrect code. Try again.', 400);
  }

  await WhatsappOtpChallenge.deleteOne({ mobile });

  const verificationToken = jwt.sign(
    { purpose: 'wa_otp', mobile },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES }
  );

  return successResponse(res, { verificationToken }, undefined, 200);
});
