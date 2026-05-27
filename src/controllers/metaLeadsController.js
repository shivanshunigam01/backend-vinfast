const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const Lead = require('../models/Lead');
const MetaLead = require('../models/MetaLead');
const { productModels } = require('../constants/enums');

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

function extractFlowToken(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  const s = value.trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeProviderEnvelope(payload) {
  if (payload == null || typeof payload !== 'object') {
    throw new ApiError(400, 'Invalid payload. Expected JSON object.');
  }
  const body = payload.body && typeof payload.body === 'object' ? payload.body : payload;
  const flowToken = extractFlowToken(body.flow_token);
  return { envelope: payload, body, flowToken };
}

async function upsertLeadFromWebhook(payload) {
  const { envelope, body, flowToken } = normalizeProviderEnvelope(payload);
  const metaUniqueId = envelope.uniqueId || envelope._id || envelope.uniqueid || undefined;

  const leadPatch = {
    metaUniqueId: metaUniqueId ? String(metaUniqueId).trim() : undefined,
    name: String(body.screen_0_Name_0 || flowToken.Name || '').trim() || 'Meta Lead',
    mobile: String(body.screen_0_Contact_No_1 || body.whatsapp_number || flowToken.MobileNumber || '').trim(),
    email: body.screen_0_Email_ID_4 ? String(body.screen_0_Email_ID_4).trim() : undefined,
    city: String(stripAfterUnderscore(body.screen_0_State_2) || '').trim() || 'Unknown',
    model: normalizeModel(body.screen_0_Interested_Model_5),
    source: 'Meta Ads',
    remarks: metaUniqueId ? `Meta webhook: ${String(metaUniqueId)}` : undefined,
    financeNeeded: false,
    exchangeNeeded: false,
    pageSource: envelope.namespace ? String(envelope.namespace) : undefined,
  };

  if (!leadPatch.mobile) {
    throw new ApiError(400, 'Meta payload missing mobile number.');
  }
  if (!productModels.includes(leadPatch.model)) {
    leadPatch.model = 'VF 7';
  }

  if (leadPatch.metaUniqueId) {
    return await Lead.findOneAndUpdate(
      { metaUniqueId: leadPatch.metaUniqueId },
      { $set: leadPatch },
      { upsert: true, new: true, runValidators: true },
    );
  }
  return await Lead.create(leadPatch);
}

async function upsertMetaLeadDoc(payload, leadDoc) {
  const { envelope, body } = normalizeProviderEnvelope(payload);
  const uniqueId = envelope.uniqueId || envelope._id || envelope.uniqueid || undefined;

  const patch = {
    uniqueId: uniqueId ? String(uniqueId).trim() : undefined,
    webhookNamespace: envelope.namespace ? String(envelope.namespace) : undefined,
    method: envelope.method ? String(envelope.method) : undefined,
    url: envelope.url ? String(envelope.url) : undefined,
    headers: envelope.headers || undefined,
    rawPayload: envelope,
    rawBody: body,
    name: body.screen_0_Name_0 ? String(body.screen_0_Name_0).trim() : undefined,
    mobile: body.screen_0_Contact_No_1 ? String(body.screen_0_Contact_No_1).trim() : undefined,
    whatsappNumber: body.whatsapp_number ? String(body.whatsapp_number).trim() : undefined,
    email: body.screen_0_Email_ID_4 ? String(body.screen_0_Email_ID_4).trim() : undefined,
    state: stripAfterUnderscore(body.screen_0_State_2),
    pin: body.screen_0_PIN_3 ? String(body.screen_0_PIN_3).trim() : undefined,
    interestedModel: stripAfterUnderscore(body.screen_0_Interested_Model_5),
    existingVehicle: body.screen_0_Existing_Vehicle__6
      ? String(body.screen_0_Existing_Vehicle__6).trim()
      : undefined,
    flowToken: extractFlowToken(body.flow_token),
    receivedAt: envelope.receivedAt ? new Date(envelope.receivedAt) : undefined,
    leadId: leadDoc?._id,
  };

  if (patch.uniqueId) {
    return await MetaLead.findOneAndUpdate(
      { uniqueId: patch.uniqueId },
      { $set: patch },
      { upsert: true, new: true, runValidators: true },
    );
  }
  return await MetaLead.create(patch);
}

/**
 * GET All_leads — public, no JWT.
 * Returns all MetaLead rows from our MongoDB (with linked Lead status/actions context).
 */
exports.getAllMetaLeads = asyncHandler(async (req, res) => {
  const docs = await MetaLead.find({})
    .populate('leadId', 'status nextFollowUp source model createdAt remarks financeNeeded exchangeNeeded')
    .sort({ createdAt: -1 });

  const data = docs.map((doc) => {
    const lead = doc.leadId && typeof doc.leadId === 'object' ? doc.leadId : null;
    return {
      _id: doc._id,
      uniqueId: doc.uniqueId,
      createdAt: doc.receivedAt || doc.createdAt,
      whatsapp_number: doc.whatsappNumber,
      screen_0_Name_0: doc.name,
      screen_0_Contact_No_1: doc.mobile,
      screen_0_State_2: doc.state,
      screen_0_PIN_3: doc.pin,
      screen_0_Email_ID_4: doc.email,
      screen_0_Interested_Model_5: doc.interestedModel,
      screen_0_Existing_Vehicle__6: doc.existingVehicle,
      flow_token: doc.flowToken,
      leadId: lead?._id || doc.leadId || null,
      status: lead?.status || 'New Lead',
      nextFollowUp: lead?.nextFollowUp || null,
      source: lead?.source || 'Meta Ads',
      model: lead?.model || normalizeModel(doc.interestedModel),
      remarks: lead?.remarks || '',
      financeNeeded: Boolean(lead?.financeNeeded),
      exchangeNeeded: Boolean(lead?.exchangeNeeded),
      rawPayload: doc.rawPayload,
    };
  });

  return successResponse(res, data, undefined, 200, {
    total: data.length,
    source: 'meta',
    provider: 'meta',
    mode: 'db',
  });
});

/**
 * POST All_leads — public, no JWT.
 * Provider pushes one webhook at a time; we store it in MetaLead + Lead collections.
 */
exports.upsertMetaLeadsPayload = asyncHandler(async (req, res) => {
  const payload = req.body;
  if (payload == null || typeof payload !== 'object') {
    throw new ApiError(400, 'Invalid payload. Expected JSON object.');
  }

  const leadDoc = await upsertLeadFromWebhook(payload);
  const metaDoc = await upsertMetaLeadDoc(payload, leadDoc);

  return successResponse(
    res,
    {
      metaLeadId: metaDoc._id,
      leadId: leadDoc?._id,
      uniqueId: metaDoc.uniqueId,
    },
    'Stored successfully',
    200,
    {
      source: 'meta',
      provider: 'meta',
      mode: 'db',
      storedAt: metaDoc.updatedAt,
    },
  );
});

/**
 * PUT /admin/meta-leads/:id (auth required)
 * Updates MetaLead fields and syncs mapped fields to linked CRM Lead.
 */
exports.updateMetaLead = asyncHandler(async (req, res) => {
  const doc = await MetaLead.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Meta lead not found');

  const bodyPatch = { ...(doc.rawBody || {}) };
  const {
    name,
    mobile,
    whatsappNumber,
    email,
    state,
    pin,
    interestedModel,
    existingVehicle,
    status,
    nextFollowUp,
    remarks,
    financeNeeded,
    exchangeNeeded,
  } = req.body || {};

  if (name !== undefined) {
    doc.name = String(name).trim();
    bodyPatch.screen_0_Name_0 = doc.name;
  }
  if (mobile !== undefined) {
    doc.mobile = String(mobile).trim();
    bodyPatch.screen_0_Contact_No_1 = doc.mobile;
  }
  if (whatsappNumber !== undefined) {
    doc.whatsappNumber = String(whatsappNumber).trim();
    bodyPatch.whatsapp_number = doc.whatsappNumber;
  }
  if (email !== undefined) {
    doc.email = String(email).trim().toLowerCase();
    bodyPatch.screen_0_Email_ID_4 = doc.email;
  }
  if (state !== undefined) {
    doc.state = String(state).trim();
    bodyPatch.screen_0_State_2 = doc.state;
  }
  if (pin !== undefined) {
    doc.pin = String(pin).trim();
    bodyPatch.screen_0_PIN_3 = doc.pin;
  }
  if (interestedModel !== undefined) {
    doc.interestedModel = String(interestedModel).trim();
    bodyPatch.screen_0_Interested_Model_5 = doc.interestedModel;
  }
  if (existingVehicle !== undefined) {
    doc.existingVehicle = String(existingVehicle).trim();
    bodyPatch.screen_0_Existing_Vehicle__6 = doc.existingVehicle;
  }

  doc.rawBody = bodyPatch;
  await doc.save();

  // Sync editable fields into linked CRM Lead if present.
  if (doc.leadId) {
    const leadPatch = {};
    if (name !== undefined) leadPatch.name = doc.name || 'Meta Lead';
    if (mobile !== undefined) leadPatch.mobile = doc.mobile;
    if (email !== undefined) leadPatch.email = doc.email || undefined;
    if (state !== undefined) leadPatch.city = doc.state || 'Unknown';
    if (interestedModel !== undefined) leadPatch.model = normalizeModel(doc.interestedModel);
    if (status !== undefined) leadPatch.status = String(status).trim();
    if (nextFollowUp !== undefined) leadPatch.nextFollowUp = nextFollowUp || null;
    if (remarks !== undefined) leadPatch.remarks = String(remarks || '').trim() || undefined;
    if (financeNeeded !== undefined) leadPatch.financeNeeded = Boolean(financeNeeded);
    if (exchangeNeeded !== undefined) leadPatch.exchangeNeeded = Boolean(exchangeNeeded);

    if (Object.keys(leadPatch).length > 0) {
      await Lead.findByIdAndUpdate(doc.leadId, leadPatch, { new: true, runValidators: true });
    }
  }

  const refreshed = await MetaLead.findById(doc._id).populate(
    'leadId',
    'status nextFollowUp source model createdAt remarks financeNeeded exchangeNeeded',
  );
  const lead = refreshed.leadId && typeof refreshed.leadId === 'object' ? refreshed.leadId : null;

  return successResponse(res, {
    _id: refreshed._id,
    uniqueId: refreshed.uniqueId,
    createdAt: refreshed.receivedAt || refreshed.createdAt,
    whatsapp_number: refreshed.whatsappNumber,
    screen_0_Name_0: refreshed.name,
    screen_0_Contact_No_1: refreshed.mobile,
    screen_0_State_2: refreshed.state,
    screen_0_PIN_3: refreshed.pin,
    screen_0_Email_ID_4: refreshed.email,
    screen_0_Interested_Model_5: refreshed.interestedModel,
    screen_0_Existing_Vehicle__6: refreshed.existingVehicle,
    flow_token: refreshed.flowToken,
    leadId: lead?._id || refreshed.leadId || null,
    status: lead?.status || 'New Lead',
    nextFollowUp: lead?.nextFollowUp || null,
    source: lead?.source || 'Meta Ads',
    model: lead?.model || normalizeModel(refreshed.interestedModel),
    remarks: lead?.remarks || '',
    financeNeeded: Boolean(lead?.financeNeeded),
    exchangeNeeded: Boolean(lead?.exchangeNeeded),
  }, 'Updated successfully');
});
