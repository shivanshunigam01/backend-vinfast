/**
 * Google reCAPTCHA v2/v3 server-side verification.
 * Set RECAPTCHA_SECRET_KEY in the environment (pair with VITE_RECAPTCHA_SITE_KEY on the SPA).
 */

async function verifyRecaptchaResponse(token, remoteip) {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return { ok: false, message: 'Security verification required. Please try again.' };
  }

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token.trim());
  if (remoteip) params.append('remoteip', String(remoteip));

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    return { ok: false, message: 'Security verification failed. Please try again.' };
  }

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? '0.5');
  if (typeof data.score === 'number' && !Number.isNaN(minScore) && data.score < minScore) {
    return { ok: false, message: 'Security verification failed. Please try again.' };
  }

  return { ok: true };
}

function stripRecaptchaFromBody(body) {
  if (body != null && typeof body === 'object') {
    delete body.recaptchaToken;
  }
}

module.exports = { verifyRecaptchaResponse, stripRecaptchaFromBody };
