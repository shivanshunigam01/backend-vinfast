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
  if (target.includes('LIMO')) return 'Limo Green';
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

function manualUniqueId(prefix = 'manual') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a webhook-shaped envelope from flat admin/manual input. */
function buildManualPayload(input, options = {}) {
  const uniqueId = input.uniqueId ? String(input.uniqueId).trim() : manualUniqueId(options.idPrefix || 'manual');
  const now = new Date();
  const body = {
    createdAt: now.toLocaleString(),
    whatsapp_number: String(input.whatsappNumber || input.mobile || '').trim(),
    screen_0_Name_0: String(input.name || '').trim(),
    screen_0_Contact_No_1: String(input.mobile || '').trim(),
    screen_0_State_2: input.state != null ? String(input.state).trim() : '',
    screen_0_PIN_3: input.pin != null ? String(input.pin).trim() : '',
    screen_0_Email_ID_4: input.email != null ? String(input.email).trim() : '',
    screen_0_Interested_Model_5: input.interestedModel != null ? String(input.interestedModel).trim() : '',
    screen_0_Existing_Vehicle__6:
      input.existingVehicle != null ? String(input.existingVehicle).trim() : 'N/A',
  };

  return {
    namespace: options.namespace || 'ManualEntry',
    method: 'POST',
    uniqueId,
    receivedAt: now.toISOString(),
    body,
  };
}

async function applyCrmFieldsToLead(leadId, input) {
  if (!leadId || input == null || typeof input !== 'object') return null;
  const patch = {};
  if (input.status !== undefined) patch.status = String(input.status).trim();
  if (input.nextFollowUp !== undefined) patch.nextFollowUp = input.nextFollowUp || null;
  if (input.remarks !== undefined) patch.remarks = String(input.remarks || '').trim() || undefined;
  if (input.financeNeeded !== undefined) patch.financeNeeded = Boolean(input.financeNeeded);
  if (input.exchangeNeeded !== undefined) patch.exchangeNeeded = Boolean(input.exchangeNeeded);
  if (input.source !== undefined) patch.source = String(input.source).trim() || 'Meta Ads';
  if (Object.keys(patch).length === 0) return null;
  return Lead.findByIdAndUpdate(leadId, patch, { new: true, runValidators: true });
}

function formatMetaLeadResponse(doc) {
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
  };
}

async function persistManualMetaLeadInput(input, options = {}) {
  if (!input?.mobile || !String(input.mobile).trim()) {
    throw new ApiError(400, 'Mobile is required.');
  }
  if (!input?.name || !String(input.name).trim()) {
    throw new ApiError(400, 'Name is required.');
  }

  const payload = buildManualPayload(input, options);
  const leadDoc = await upsertLeadFromWebhook(payload);
  await applyCrmFieldsToLead(leadDoc._id, input);
  const metaDoc = await upsertMetaLeadDoc(payload, leadDoc);
  const refreshed = await MetaLead.findById(metaDoc._id).populate(
    'leadId',
    'status nextFollowUp source model createdAt remarks financeNeeded exchangeNeeded',
  );
  return refreshed;
}

async function upsertLeadFromWebhook(payload) {
  const { envelope, body, flowToken } = normalizeProviderEnvelope(payload);
  const metaUniqueId = envelope.uniqueId || envelope._id || envelope.uniqueid || undefined;

  const mobile = String(body.screen_0_Contact_No_1 || body.whatsapp_number || flowToken.MobileNumber || '').trim();
  if (!mobile) {
    throw new ApiError(400, 'Meta payload missing mobile number.');
  }

  const { intakePvLead } = require('../utils/pvLeadIntake');
  const { lead } = await intakePvLead({
    metaUniqueId: metaUniqueId ? String(metaUniqueId).trim() : undefined,
    name: String(body.screen_0_Name_0 || flowToken.Name || '').trim() || 'Meta Lead',
    mobile,
    email: body.screen_0_Email_ID_4 ? String(body.screen_0_Email_ID_4).trim() : undefined,
    city: String(stripAfterUnderscore(body.screen_0_State_2) || '').trim() || 'Unknown',
    model: normalizeModel(body.screen_0_Interested_Model_5),
    source: 'Meta Ads',
    status: 'Enquiry',
    remarks: metaUniqueId ? `Meta webhook: ${String(metaUniqueId)}` : undefined,
    pageSource: envelope.namespace ? String(envelope.namespace) : undefined,
    historyReason: 'Lead created from Meta Ads',
  });

  return lead;
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

  return successResponse(res, formatMetaLeadResponse(refreshed), 'Updated successfully');
});

/**
 * POST /admin/meta-leads (auth required)
 * Create a single Meta lead + linked CRM Lead from admin form.
 */
exports.createManualMetaLead = asyncHandler(async (req, res) => {
  const refreshed = await persistManualMetaLeadInput(req.body || {}, { namespace: 'ManualEntry' });
  return successResponse(res, formatMetaLeadResponse(refreshed), 'Meta lead created', 201);
});

/**
 * POST /admin/meta-leads/bulk (auth required)
 * Import multiple leads (e.g. from Excel) — each row stored in MetaLead + Lead.
 */
exports.bulkCreateMetaLeads = asyncHandler(async (req, res) => {
  const leads = req.body?.leads;
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new ApiError(400, 'Provide a non-empty "leads" array.');
  }
  if (leads.length > 500) {
    throw new ApiError(400, 'Maximum 500 leads per import.');
  }

  const results = { created: 0, failed: [] };
  for (let i = 0; i < leads.length; i += 1) {
    const row = leads[i];
    try {
      await persistManualMetaLeadInput(row, {
        namespace: 'ExcelImport',
        idPrefix: `import-${i}`,
      });
      results.created += 1;
    } catch (err) {
      results.failed.push({
        row: i + 1,
        name: row?.name,
        mobile: row?.mobile,
        message: err?.message || 'Failed to import row',
      });
    }
  }

  return successResponse(
    res,
    results,
    `Imported ${results.created} of ${leads.length} lead(s)`,
    200,
    { total: leads.length, failed: results.failed.length },
  );
});
