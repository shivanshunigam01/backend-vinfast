/**
 * WhatsApp OTP — Patliputra Motors / api-wa.co campaign API.
 * URL and apiKey are fixed in code (not read from .env).
 *
 * NOTE: Messages go to api-wa.co — they will NOT appear in the AiSensy (aisensy.com) dashboard.
 * Use the provider dashboard that matches this API key / api-wa.co.
 */

const ZENTROVERSE_WA_CAMPAIGN_URL =
  'https://backend.api-wa.co/campaign/zentroverse-global/api/v2';

const ZENTROVERSE_WA_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZTc2NWQxNGY3ZWZkMGUzMjM3Nzk3NiIsIm5hbWUiOiJQYXRsaXB1dHJhIE1vdG9ycyIsImFwcE5hbWUiOiJBaVNlbnN5IiwiY2xpZW50SWQiOiI2OWU3NjVkMTRmN2VmZDBlMzIzNzc5NmUiLCJhY3RpdmVQbGFuIjoiTk9ORSIsImlhdCI6MTc3Njc3MjU2MX0.OIxcKrvdMJtz1K8D9y096cqzAiQ5jW-lWzpErCEvaOM';

const ZENTROVERSE_CAMPAIGN_NAME = 'whatssap_verify';
const ZENTROVERSE_SOURCE = 'new-landing-page form';

/**
 * Match Patliputra Motors curl: destination "9031675435" (plain 10-digit Indian mobile,
 * no leading zero, no country code).
 */
const ZENTROVERSE_DEST_LEADING_ZERO = false;

/**
 * WhatsApp / BSP rejects template body variables that contain emoji ("Parameter at index 0 contains emoji").
 */
function sanitizeWaTemplateParam(str, fallback = 'Customer') {
  let s = String(str ?? '');
  try {
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFKC');
    }
    // Pictographic symbols (includes most emoji) — avoid \p{Emoji} (can be over-broad in some runtimes)
    s = s.replace(/\p{Extended_Pictographic}/gu, '');
  } catch {
    s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
  }
  s = s.replace(/[\uFE0F\u200D]/g, '');
  s = s.trim().replace(/\s+/g, ' ');
  if (!s) return fallback;
  return s.slice(0, 60);
}

/** OTP must be digits only for safety. */
function sanitizeOtpParam(otp) {
  return String(otp ?? '').replace(/\D/g, '').slice(0, 6);
}

/**
 * When ZENTROVERSE_DEST_LEADING_ZERO is true: "0" + 10-digit mobile (e.g. "09771495587").
 * Otherwise plain 10-digit Indian mobile to match the Patliputra Motors curl (e.g. "9031675435").
 */
function destinationForZentroverseWa(mobile10) {
  const d = String(mobile10 || '')
    .replace(/\D/g, '')
    .slice(-10);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  if (ZENTROVERSE_DEST_LEADING_ZERO) return `0${d}`;
  return d;
}

async function parseCampaignResponse(res, text) {
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      json.message ||
      json.error ||
      json.msg ||
      (Array.isArray(json.errors) && json.errors.join?.('; ')) ||
      text ||
      `HTTP ${res.status}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.aisensyBody = json;
    throw err;
  }
  if (json && json.success === false) {
    const msg = json.message || json.error || 'WhatsApp campaign API rejected the request';
    const err = new Error(msg);
    err.aisensyBody = json;
    throw err;
  }
  return json;
}

/**
 * Send OTP via Zentroverse WA campaign.
 */
async function sendOtpViaAisensy({ mobile10, displayName, otpCode }) {
  const destination = destinationForZentroverseWa(mobile10);
  if (!destination) {
    throw new Error('Invalid destination mobile');
  }

  // From website: destination (mobile) + userName (full name). Rest matches Zentroverse curl.
  const userName = sanitizeWaTemplateParam(String(displayName || '').trim(), 'user');

  const otpStr = sanitizeOtpParam(otpCode);
  if (!otpStr) {
    throw new Error('Invalid OTP');
  }

  const payload = {
    apiKey: ZENTROVERSE_WA_API_KEY,
    campaignName: ZENTROVERSE_CAMPAIGN_NAME,
    destination,
    userName,
    templateParams: ['$FirstName', otpStr],
    source: ZENTROVERSE_SOURCE,
    media: {},
    buttons: [
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [
          {
            type: 'text',
            text: otpStr,
          },
        ],
      },
    ],
    carouselCards: [],
    location: {},
    attributes: {},
    paramsFallbackValue: {
      FirstName: 'user',
    },
  };

  const res = await fetch(ZENTROVERSE_WA_CAMPAIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const json = await parseCampaignResponse(res, text);
  console.log('[whatsapp-otp] api-wa raw response:', text.slice(0, 2000));
  console.log('[whatsapp-otp] api-wa parsed:', JSON.stringify(json));
  return json;
}

function normalizeDestination(mobile10) {
  const d = String(mobile10 || '').replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  return d;
}

function destinationForAisensy(mobile10) {
  return destinationForZentroverseWa(mobile10);
}

module.exports = {
  sendOtpViaAisensy,
  normalizeDestination,
  destinationForAisensy,
};
