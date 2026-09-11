const Lead = require('../models/Lead');
const TestDrive = require('../models/TestDrive');
const Enquiry = require('../models/Enquiry');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { syncTestDriveToTdBooking } = require('../utils/tdBookingSync');
const { evaluateRepeatDrive } = require('../utils/tdRepeatDrive');
const { intakePvLead } = require('../utils/pvLeadIntake');
const { normalizeLeadModelForStorage } = require('../utils/leadModel');

const MSG_LEAD_OK =
  'Thank you! Our EV advisor will contact you within 10 minutes.';
const MSG_TD_OK = 'Test drive request submitted successfully.';
const MSG_ENQ_OK = 'Your enquiry has been submitted successfully.';

exports.createLead = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const interestedModels = Array.isArray(body.interestedModels)
    ? body.interestedModels
    : body.interestedModels
      ? [body.interestedModels]
      : undefined;
  const { lead } = await intakePvLead({
    name: body.name,
    mobile: body.mobile,
    email: body.email,
    city: body.city,
    otherCity: body.otherCity,
    model: normalizeLeadModelForStorage(body.model),
    interestedModels,
    interest: body.interest,
    source: body.source?.trim() || 'Website',
    status: 'Enquiry',
    remarks: body.remarks,
    financeNeeded: body.financeNeeded,
    exchangeNeeded: body.exchangeNeeded,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    pageSource: body.pageSource,
    historyReason: 'Lead submitted from website',
  });
  return successResponse(res, lead, MSG_LEAD_OK, 201);
});

exports.createTestDrive = asyncHandler(async (req, res) => {
  // Multiple test drives per customer are fine (different models); block only
  // same-model duplicates and completed-drive repeats (those need admin approval).
  const body = req.body || {};
  const interestedRaw = Array.isArray(body.interestedModels)
    ? body.interestedModels
    : body.interestedModels
      ? [body.interestedModels]
      : [];
  const modelsRaw = Array.isArray(body.models) ? body.models : body.models ? [body.models] : [];
  const modelList = [
    ...new Set(
      [...modelsRaw, body.model, ...interestedRaw]
        .map((m) => String(m || '').trim())
        .filter(Boolean),
    ),
  ];
  if (!modelList.length) {
    throw new ApiError(400, 'Select at least one model for the test drive');
  }

  const mobile10 = String(body.mobile || '').replace(/\D/g, '').slice(-10);
  for (const model of modelList) {
    const summary = await evaluateRepeatDrive(mobile10, model);
    if (summary.activeSameModel) {
      throw new ApiError(
        409,
        `You already have a ${model} test drive booked (${summary.activeSameModel.bookingId}). Call the showroom to reschedule it.`,
      );
    }
    if (summary.completedSameModel) {
      throw new ApiError(
        409,
        `You have already completed a ${model} test drive. For a repeat test drive, please call the showroom — our team will arrange it for you.`,
      );
    }
  }

  const {
    interestedModels: _im,
    models: _models,
    model: _primaryModel,
    ...tdShared
  } = body;

  const created = [];
  for (const model of modelList) {
    const testDrive = await TestDrive.create({ ...tdShared, model });
    await syncTestDriveToTdBooking(testDrive);
    created.push(testDrive);

    await intakePvLead({
      name: body.customerName || body.name,
      mobile: body.mobile,
      email: body.email,
      city: body.city,
      otherCity: body.otherCity,
      model: normalizeLeadModelForStorage(model),
      interestedModels: modelList,
      source: 'Test Drive',
      status: 'Test Drive Booked',
      interest: 'Test Drive',
      testDriveId: testDrive._id,
      remarks: `Test drive requested for ${body.preferredDate || ''} ${body.preferredTime || ''}`.trim(),
      historyReason: 'Lead created from test drive booking',
    });
  }

  const primary = created[0];
  const msg =
    created.length > 1
      ? `Test drive requests submitted for ${modelList.join(', ')}.`
      : MSG_TD_OK;
  return successResponse(res, created.length === 1 ? primary : { bookings: created, model: modelList }, msg, 201);
});

exports.createEnquiry = asyncHandler(async (req, res) => {
  const interestedModels = Array.isArray(req.body.interestedModels)
    ? req.body.interestedModels
    : req.body.interestedModels
      ? [req.body.interestedModels]
      : undefined;
  const { interestedModels: _im, ...enqBody } = req.body || {};
  const enquiry = await Enquiry.create(enqBody);

  await intakePvLead({
    name: req.body.name,
    mobile: req.body.mobile,
    email: req.body.email,
    city: req.body.city,
    otherCity: req.body.otherCity,
    model: normalizeLeadModelForStorage(req.body.model || 'VF 7'),
    interestedModels,
    source: 'Enquiry',
    status: 'Enquiry',
    interest: req.body.interest,
    enquiryId: enquiry._id,
    remarks: req.body.message || req.body.remarks,
    historyReason: 'Lead created from website enquiry',
  });

  return successResponse(res, enquiry, MSG_ENQ_OK, 201);
});
