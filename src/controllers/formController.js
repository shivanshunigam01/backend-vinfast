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
  const { lead } = await intakePvLead({
    name: body.name,
    mobile: body.mobile,
    email: body.email,
    city: body.city,
    otherCity: body.otherCity,
    model: normalizeLeadModelForStorage(body.model),
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
  const mobile10 = String(req.body.mobile || '').replace(/\D/g, '').slice(-10);
  const summary = await evaluateRepeatDrive(mobile10, req.body.model);
  if (summary.activeSameModel) {
    throw new ApiError(
      409,
      `You already have a ${req.body.model} test drive booked (${summary.activeSameModel.bookingId}). Call the showroom to reschedule it.`,
    );
  }
  if (summary.completedSameModel) {
    throw new ApiError(
      409,
      `You have already completed a ${req.body.model} test drive. For a repeat test drive, please call the showroom — our team will arrange it for you.`,
    );
  }

  const testDrive = await TestDrive.create(req.body);
  await syncTestDriveToTdBooking(testDrive);

  await intakePvLead({
    name: req.body.customerName || req.body.name,
    mobile: req.body.mobile,
    email: req.body.email,
    city: req.body.city,
    otherCity: req.body.otherCity,
    model: normalizeLeadModelForStorage(req.body.model),
    source: 'Test Drive',
    status: 'Test Drive Booked',
    interest: 'Test Drive',
    testDriveId: testDrive._id,
    remarks: `Test drive requested for ${req.body.preferredDate || ''} ${req.body.preferredTime || ''}`.trim(),
    historyReason: 'Lead created from test drive booking',
  });

  return successResponse(res, testDrive, MSG_TD_OK, 201);
});

exports.createEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.create(req.body);

  await intakePvLead({
    name: req.body.name,
    mobile: req.body.mobile,
    email: req.body.email,
    city: req.body.city,
    otherCity: req.body.otherCity,
    model: normalizeLeadModelForStorage(req.body.model || 'VF 7'),
    source: 'Enquiry',
    status: 'Enquiry',
    interest: req.body.interest,
    enquiryId: enquiry._id,
    remarks: req.body.message || req.body.remarks,
    historyReason: 'Lead created from website enquiry',
  });

  return successResponse(res, enquiry, MSG_ENQ_OK, 201);
});
