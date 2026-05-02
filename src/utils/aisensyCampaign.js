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

/** AiSensy accepts E.164 (+9198…) or 91… per account; toggle with AISENSY_DESTINATION_USE_PLUS. */
function destinationForAisensy(mobile10) {
  const digits = normalizeDestination(mobile10);
  if (!digits || digits.length < 11) return null;
  if (digits.startsWith('+')) return digits;
  const usePlus = process.env.AISENSY_DESTINATION_USE_PLUS !== 'false';
  return usePlus ? `+${digits}` : digits;
}

/**
 * Build templateParams that match the WhatsApp template linked to the AiSensy API campaign
 * (same count/order as {{1}}, {{2}}, …). Wrong layout causes:
 * "Template params does not match the campaign".
 *
 * AISENSY_OTP_PARAM_LAYOUT (preferred):
 *   - otp_only     → [OTP] — single-variable OTP templates
 *   - name_otp     → [Name, OTP] — default Meta-style two vars
 *   - otp_name     → [OTP, Name] — reversed two vars
 * Legacy AISENSY_OTP_TEMPLATE_MODE: one → otp_only, two → name_otp
 */
function buildTemplateParams(displayName, otpCode) {
  const first = String(displayName || 'Customer').trim().slice(0, 60) || 'Customer';
  const code = String(otpCode);

  const explicit = process.env.AISENSY_OTP_PARAM_LAYOUT?.trim()?.toLowerCase();
  let layout = explicit;
  if (!layout) {
    const legacy = (process.env.AISENSY_OTP_TEMPLATE_MODE || 'two').toLowerCase();
    if (legacy === 'one' || legacy === '1') layout = 'otp_only';
    else if (legacy === 'two' || legacy === '2') layout = 'name_otp';
    else layout = 'name_otp';
  }

  if (layout === 'otp_only' || layout === 'single' || layout === 'one') {
    return [code];
  }
  if (layout === 'otp_name' || layout === 'otp_first') {
    return [code, first];
  }
  // name_otp, name_then_otp, two, default
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
    const msg = json.message || json.error || 'AiSensy rejected the request';
    const err = new Error(msg);
    err.aisensyBody = json;
    throw err;
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

  const destination = destinationForAisensy(mobile10);
  if (!destination) {
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

  const otpOnlyTemplate = templateParams.length === 1;
  const useFirstNameFallback =
    !otpOnlyTemplate && process.env.AISENSY_USE_PARAMS_FALLBACK_FIRSTNAME !== 'false';

  // Shape matches AiSensy campaign POST examples / n8n integration — avoid empty media/buttons objects.
  const payload = {
    apiKey,
    campaignName,
    destination,
    userName,
    templateParams,
    source: process.env.AISENSY_SOURCE?.trim() || 'website-form',
    attributes: {},
    meta_data: [],
    defaultCountryCode: process.env.AISENSY_DEFAULT_COUNTRY_CODE?.trim() || 'IN',
    paramsFallbackValue: useFirstNameFallback ? { FirstName: firstNameFallback } : {},
  };

  return sendCampaignPayload(payload);
}

module.exports = {
  sendOtpViaAisensy,
  normalizeDestination,
  destinationForAisensy,
  buildTemplateParams,
};
