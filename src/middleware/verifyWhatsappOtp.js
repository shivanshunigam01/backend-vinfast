const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { errorResponse } = require('../utils/apiResponse');

function isOtpEnabled() {
  return process.env.WHATSAPP_OTP_ENABLED === 'true';
}

function extractMobile10(body) {
  const raw = body.mobile ?? body.Mobile;
  const d = String(raw || '').replace(/\D/g, '').slice(-10);
  if (/^[6-9]\d{9}$/.test(d)) return d;
  return null;
}

/**
 * When WHATSAPP_OTP_ENABLED=true, checks the short-lived JWT issued by POST /whatsapp-otp/verify
 * against the submitted mobile.
 *
 * - `required: true` — submissions without a valid verification token are rejected (400).
 * - `required: false` — token is validated only when present (soft mode).
 */
module.exports = ({ required = false } = {}) =>
  asyncHandler(async (req, res, next) => {
    if (!isOtpEnabled()) {
      delete req.body.whatsappVerificationToken;
      return next();
    }

    const mobile = extractMobile10(req.body);
    const token = req.body.whatsappVerificationToken;

    if (!mobile) {
      // Let the route's mobile validator produce the accurate error.
      delete req.body.whatsappVerificationToken;
      return next();
    }

    if (!token || typeof token !== 'string') {
      delete req.body.whatsappVerificationToken;
      if (required) {
        return errorResponse(
          res,
          'Please verify your mobile number via the WhatsApp code before submitting.',
          400
        );
      }
      return next();
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.purpose !== 'wa_otp' || payload.mobile !== mobile) {
        throw new Error('bad');
      }
    } catch {
      return errorResponse(
        res,
        'WhatsApp verification expired or invalid. Please verify your mobile again.',
        400
      );
    }

    delete req.body.whatsappVerificationToken;
    next();
  });
