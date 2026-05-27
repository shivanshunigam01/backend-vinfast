const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');

function buildUpstreamHeaders() {
  const headers = { Accept: 'application/json' };
  const token = (process.env.META_LEADS_API_TOKEN || '').trim();
  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}

/** Normalize Meta / third-party JSON into { data: array, meta: object }. */
function normalizeMetaPayload(body) {
  if (body == null) {
    return { data: [], meta: { total: 0, source: 'meta' } };
  }

  if (typeof body === 'object' && body.success === true && 'data' in body) {
    const data = Array.isArray(body.data) ? body.data : body.data != null ? [body.data] : [];
    const meta =
      body.meta && typeof body.meta === 'object'
        ? { ...body.meta, source: body.meta.source || 'meta' }
        : { total: data.length, source: 'meta' };
    return { data, meta };
  }

  if (Array.isArray(body)) {
    return { data: body, meta: { total: body.length, source: 'meta' } };
  }

  if (typeof body === 'object') {
    if (Array.isArray(body.data)) {
      return { data: body.data, meta: { total: body.data.length, source: 'meta' } };
    }
    if (Array.isArray(body.leads)) {
      return { data: body.leads, meta: { total: body.leads.length, source: 'meta' } };
    }
  }

  return { data: [], meta: { total: 0, source: 'meta' } };
}

/**
 * GET All_leads — public, no JWT.
 * Proxies META_LEADS_UPSTREAM_URL (your Meta / whitelisted leads API).
 */
exports.getAllMetaLeads = asyncHandler(async (req, res) => {
  const upstream = (process.env.META_LEADS_UPSTREAM_URL || '').trim();
  if (!upstream) {
    throw new ApiError(
      503,
      'Meta leads API is not configured. Set META_LEADS_UPSTREAM_URL in server .env to your Meta leads URL.',
    );
  }

  const timeoutMs = Math.max(Number(process.env.META_LEADS_TIMEOUT_MS) || 25000, 5000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamRes = await fetch(upstream, {
      method: 'GET',
      headers: buildUpstreamHeaders(),
      signal: controller.signal,
    });

    const text = await upstreamRes.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(502, 'Meta leads upstream returned invalid JSON');
    }

    if (!upstreamRes.ok) {
      const msg =
        body?.message ||
        body?.error?.message ||
        (typeof body?.error === 'string' ? body.error : null) ||
        `Meta upstream returned ${upstreamRes.status}`;
      throw new ApiError(upstreamRes.status >= 500 ? 502 : upstreamRes.status, msg);
    }

    const { data, meta } = normalizeMetaPayload(body);
    return successResponse(res, data, undefined, 200, {
      ...meta,
      provider: 'meta',
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(504, 'Meta leads upstream timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
});
