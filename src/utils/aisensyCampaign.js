/**
 * AiSensy WhatsApp campaign API — sends template messages (e.g. OTP campaign).
 * @see https://aisensy.com/tutorials/api-reference-docs
 */
const DEFAULT_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

function normalizeDestination(mobile10) {
  const d = String(mobile10 || '').replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  return d;
}

/**
 * Build templateParams based on env — matches your WhatsApp template variable order.
 * AISENSY_OTP_TEMPLATE_MODE=two (default: [FirstName, OTP]) | one (OTP only)
 */
function buildTemplateParams(displayName, otpCode) {
  const mode = (process.env.AISENSY_OTP_TEMPLATE_MODE || 'two').toLowerCase();
  const first = String(displayName || 'Customer').trim().slice(0, 60) || 'Customer';
  const code = String(otpCode);
  if (mode === 'one' || mode === '1') return [code];
  return [first, code];
}

async function sendCampaignPayload(payload) {
  const url = (process.env.AISENSY_API_URL || DEFAULT_URL).trim();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json.message || json.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Send OTP via AiSensy campaign named AISENSY_OTP_CAMPAIGN_NAME (e.g. "otp").
 */
async function sendOtpViaAisensy({ mobile10, displayName, otpCode }) {
  const apiKey = process.env.AISENSY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('AISENSY_API_KEY is not configured');
  }

  const destination = normalizeDestination(mobile10);
  if (!destination || destination.length < 11) {
    throw new Error('Invalid destination mobile');
  }

  const campaignName = process.env.AISENSY_OTP_CAMPAIGN_NAME?.trim() || 'otp';
  const userName =
    process.env.AISENSY_USER_NAME?.trim() ||
    process.env.AISENSY_SENDER_USER_NAME?.trim() ||
    'Customer';

  const templateParams = buildTemplateParams(displayName, otpCode);
  const firstNameFallback =
    String(displayName || 'Customer')
      .trim()
      .split(/\s+/)[0] || 'user';

  const payload = {
    apiKey,
    campaignName,
    destination,
    userName,
    templateParams,
    source: process.env.AISENSY_SOURCE?.trim() || 'website-form',
    media: {},
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {},
    paramsFallbackValue: {
      FirstName: firstNameFallback,
    },
  };

  return sendCampaignPayload(payload);
}

module.exports = {
  sendOtpViaAisensy,
  normalizeDestination,
};
