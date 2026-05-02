const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { errorResponse } = require('../utils/apiResponse');

function isOtpRequired() {
  return process.env.WHATSAPP_OTP_ENABLED === 'true';
}

function extractMobile10(body) {
  const raw = body.mobile ?? body.Mobile;
  const d = String(raw || '').replace(/\D/g, '').slice(-10);
  if (/^[6-9]\d{9}$/.test(d)) return d;
  return null;
}

/** When WHATSAPP_OTP_ENABLED=true, require valid short-lived JWT from POST /whatsapp-otp/verify matching submitted mobile. */
module.exports = asyncHandler(async (req, res, next) => {
  if (!isOtpRequired()) {
    delete req.body.whatsappVerificationToken;
    return next();
  }

  const mobile = extractMobile10(req.body);
  const token = req.body.whatsappVerificationToken;

  if (!mobile || !token || typeof token !== 'string') {
    return errorResponse(
      res,
      'WhatsApp verification required. Please verify your mobile number with the code we send.',
      400
    );
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
