const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const fs = require('fs');
const path = require('path');
const Lead = require('../models/Lead');
const { productModels } = require('../constants/enums');

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
    /**
     * Provider webhook envelope case:
     * { _id, url, method, headers, body: { ...fields }, flow_token: {...}, uniqueId, receivedAt, ... }
     * In this format we store a single lead row derived from `body`.
     */
    if (body.body && typeof body.body === 'object') {
      const leadRow = { ...body.body };
      if (body.flow_token && typeof body.flow_token === 'object') leadRow.flow_token = body.flow_token;
      if (body.uniqueId) leadRow.uniqueId = body.uniqueId;
      if (body.receivedAt) leadRow.receivedAt = body.receivedAt;
      if (body.createdAt) leadRow.createdAt = body.createdAt;
      return { data: [leadRow], meta: { total: 1, source: 'meta' } };
    }

    if (Array.isArray(body.data)) {
      return { data: body.data, meta: { total: body.data.length, source: 'meta' } };
    }
    if (Array.isArray(body.leads)) {
      return { data: body.leads, meta: { total: body.leads.length, source: 'meta' } };
    }
  }

  // Last resort: treat any object as a single row (so provider shapes don't break the UI).
  return { data: [body], meta: { total: 1, source: 'meta' } };
}

function stripAfterUnderscore(v) {
  const s = v == null ? '' : String(v).trim();
  if (!s) return '';
  const idx = s.indexOf('_');
  return idx >= 0 ? s.slice(idx + 1) : s;
}

function normalizeModel(raw) {
  const compact = stripAfterUnderscore(raw).toUpperCase();
  const target = compact || (raw == null ? '' : String(raw).trim().toUpperCase());

  if (target.includes('VF6')) return 'VF 6';
  if (target.includes('MPV')) return 'VF MPV 7';
  if (target.includes('VF7')) return 'VF 7';
  if (target.includes('BOTH')) return 'Both';
  return 'VF 7';
}

async function persistMetaLeadToMongo(webhookEnvelope) {
  if (!webhookEnvelope || typeof webhookEnvelope !== 'object') return null;

  // Provider sends an envelope with `body: { ...leadFields }`.
  const leadFields =
    webhookEnvelope.body && typeof webhookEnvelope.body === 'object' ? webhookEnvelope.body : webhookEnvelope;

  const flowToken =
    leadFields.flow_token && typeof leadFields.flow_token === 'object' ? leadFields.flow_token : {};

  const metaUniqueId = webhookEnvelope.uniqueId || webhookEnvelope._id || webhookEnvelope.uniqueid;

  const mapped = {
    metaUniqueId: metaUniqueId ? String(metaUniqueId).trim() : undefined,
    name: String(leadFields.screen_0_Name_0 || flowToken.Name || '').trim(),
    mobile: String(
      leadFields.screen_0_Contact_No_1 || leadFields.whatsapp_number || flowToken.MobileNumber || '',
    ).trim(),
    email: leadFields.screen_0_Email_ID_4 ? String(leadFields.screen_0_Email_ID_4).trim() : undefined,
    city: String(stripAfterUnderscore(leadFields.screen_0_State_2) || '').trim(),
    model: normalizeModel(leadFields.screen_0_Interested_Model_5),
    source: 'Meta Ads',
    remarks: metaUniqueId ? `Meta webhook: ${String(metaUniqueId)}` : undefined,
    financeNeeded: false,
    exchangeNeeded: false,
    pageSource: webhookEnvelope.namespace ? String(webhookEnvelope.namespace) : undefined,
  };

  if (!mapped.name) mapped.name = 'Meta Lead';
  if (!mapped.mobile) throw new ApiError(400, 'Meta payload missing mobile number.');
  if (!mapped.city) mapped.city = 'Unknown';
  if (!productModels.includes(mapped.model)) mapped.model = 'VF 7';

  if (mapped.metaUniqueId) {
    return await Lead.findOneAndUpdate(
      { metaUniqueId: mapped.metaUniqueId },
      { $set: mapped },
      { upsert: true, new: true, runValidators: true },
    );
  }

  return await Lead.create(mapped);
}

// Persist provider payload across requests (and server restarts if filesystem persists).
const STORE_PATH = path.join(__dirname, '..', '..', 'data', 'metaLeads.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return null;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStore(payload) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(payload ?? null, null, 2), 'utf8');
}

/**
 * GET All_leads — public, no JWT.
 * If META_LEADS_UPSTREAM_URL is configured, proxies it.
 * Otherwise returns the last payload pushed via POST (stored on disk).
 */
exports.getAllMetaLeads = asyncHandler(async (req, res) => {
  const upstream = (process.env.META_LEADS_UPSTREAM_URL || '').trim();
  if (!upstream) {
    const stored = readStore();
    const storedPayload = stored && typeof stored === 'object' ? stored.payload : undefined;

    // Backfill into Mongo if provider previously pushed but we hadn't persisted yet.
    if (storedPayload) {
      try {
        await persistMetaLeadToMongo(storedPayload);
      } catch {
        // Ignore backfill errors; still return stored payload for debugging/UI.
      }
    }

    const { data, meta } = normalizeMetaPayload(storedPayload);
    return successResponse(res, data, undefined, 200, {
      ...meta,
      provider: 'meta',
      mode: 'stored',
      storedAt: stored && typeof stored === 'object' ? stored.storedAt : undefined,
    });
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

/**
 * POST All_leads — public, no JWT.
 * Provider pushes Meta leads payload here; we persist it and serve it on GET.
 */
exports.upsertMetaLeadsPayload = asyncHandler(async (req, res) => {
  const payload = req.body;
  if (payload == null || (typeof payload !== 'object' && !Array.isArray(payload))) {
    throw new ApiError(400, 'Invalid payload. Expected JSON object or array.');
  }

  // Persist into Mongo so Admin Leads actions (edit/delete/status) work.
  await persistMetaLeadToMongo(payload);

  const stored = {
    storedAt: new Date().toISOString(),
    payload,
  };
  writeStore(stored);

  const { data, meta } = normalizeMetaPayload(payload);
  return successResponse(res, data, 'Stored successfully', 200, {
    ...meta,
    provider: 'meta',
    mode: 'stored',
    storedAt: stored.storedAt,
  });
});
