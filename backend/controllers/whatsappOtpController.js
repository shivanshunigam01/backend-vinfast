const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// ── In-memory OTP store ───────────────────────────────────────────────────────
// { mobile: { otp, expiresAt, attempts } }
const otpStore = new Map();

const TTL_MS      = Number(process.env.WHATSAPP_OTP_CODE_TTL_MS)  || 600_000; // 10 min
const MAX_ATTEMPT = Number(process.env.WHATSAPP_OTP_MAX_ATTEMPTS)  || 6;
const TOKEN_EXP   = process.env.WHATSAPP_OTP_TOKEN_EXPIRES_IN      || '15m';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── AiSensy sender ───────────────────────────────────────────────────────────
async function sendViaAisensy(mobile, otp, name = 'Customer') {
  const apiUrl      = process.env.AISENSY_API_URL;
  const apiKey      = process.env.AISENSY_API_KEY;
  const campaign    = process.env.AISENSY_OTP_CAMPAIGN_NAME || 'otp';
  const userName    = process.env.AISENSY_USER_NAME         || 'Patliputra VinFast';
  const source      = process.env.AISENSY_SOURCE            || 'website-form';
  const layout      = process.env.AISENSY_OTP_PARAM_LAYOUT  || 'otp_only';
  const usePlus     = process.env.AISENSY_DESTINATION_USE_PLUS !== 'false';
  const useFallback = process.env.AISENSY_USE_PARAMS_FALLBACK_FIRSTNAME !== 'false';
  const countryCode = process.env.AISENSY_DEFAULT_COUNTRY_CODE || 'IN';

  if (!apiUrl || !apiKey) throw new ApiError(500, 'WhatsApp OTP service not configured');

  // Build destination number
  const digits = mobile.replace(/\D/g, '');
  const number = digits.length === 10 ? `91${digits}` : digits;
  const destination = usePlus ? `+${number}` : number;

  // Build template params based on layout
  let templateParams;
  if (layout === 'name_otp') templateParams = [name, otp];
  else if (layout === 'otp_name') templateParams = [otp, name];
  else templateParams = [otp]; // otp_only (default)

  const body = {
    apiKey,
    campaignName: campaign,
    destination,
    userName,
    source,
    media: {},
    templateParams,
    tags: [],
    attributes: {},
  };

  if (useFallback) body.paramsFallbackValue = { FirstName: name };

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await resp.text();

  if (!resp.ok) {
    const verbose = process.env.AISENSY_VERBOSE_ERRORS === 'true';
    const detail  = verbose ? ` — ${text}` : '';
    throw new ApiError(502, `WhatsApp delivery failed (${resp.status})${detail}`);
  }

  return text;
}

// ── Controllers ──────────────────────────────────────────────────────────────

/** POST /api/v1/whatsapp-otp/send */
exports.sendOtp = asyncHandler(async (req, res) => {
  const { mobile, name, recaptchaToken } = req.body;

  const digits = (mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number');
  }

  if (process.env.WHATSAPP_OTP_ENABLED !== 'true') {
    throw new ApiError(503, 'WhatsApp OTP is not enabled on this server');
  }

  const otp       = generateOtp();
  const expiresAt = Date.now() + TTL_MS;
  otpStore.set(digits, { otp, expiresAt, attempts: 0 });

  // Send OTP — in dev mode skip the actual API call and just log
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[WA-OTP] ${digits} → ${otp}  (dev mode, not sent via AiSensy)`);
  } else {
    await sendViaAisensy(digits, otp, name?.trim() || 'Customer');
  }

  res.json({
    success: true,
    message: 'OTP sent to your WhatsApp number.',
    ...(process.env.NODE_ENV !== 'production' && { otp }), // expose in dev only
  });
});

/** POST /api/v1/whatsapp-otp/verify */
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, code } = req.body;

  const digits = (mobile || '').replace(/\D/g, '').slice(-10);
  if (!digits) throw new ApiError(400, 'Mobile number is required');

  const entry = otpStore.get(digits);
  const inputCode = String(code || '').replace(/\D/g, '').slice(0, 6);

  if (!entry) throw new ApiError(400, 'No OTP found for this number. Please request a new one.');
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(digits);
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPT) {
    otpStore.delete(digits);
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new OTP.');
  }

  if (inputCode !== entry.otp) {
    throw new ApiError(400, `Invalid OTP. ${MAX_ATTEMPT - entry.attempts} attempt(s) remaining.`);
  }

  otpStore.delete(digits);

  const verificationToken = jwt.sign(
    { mobile: digits, purpose: 'wa_otp', verified: true },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXP }
  );

  res.json({
    success: true,
    message: 'Mobile verified successfully.',
    data: { verificationToken },
  });
});
