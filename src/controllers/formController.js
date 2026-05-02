const Lead = require('../models/Lead');
const TestDrive = require('../models/TestDrive');
const Enquiry = require('../models/Enquiry');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { notifyNewLead, notifyNewTestDrive, notifyNewEnquiry } = require('../utils/notifyAdminEmail');

const MSG_LEAD_OK =
  'Thank you! Our EV advisor will contact you within 10 minutes.';
const MSG_LEAD_OK_EMAIL = `${MSG_LEAD_OK} Our dealership team has been notified by email.`;
const MSG_TD_OK = 'Test drive request submitted successfully.';
const MSG_TD_OK_EMAIL = `${MSG_TD_OK} Our dealership team has been notified by email.`;
const MSG_ENQ_OK = 'Your enquiry has been submitted successfully.';
const MSG_ENQ_OK_EMAIL = `${MSG_ENQ_OK} Our dealership team has been notified by email.`;

exports.createLead = asyncHandler(async (req, res) => {
  const lead = await Lead.create(req.body);
  let emailed = false;
  try {
    emailed = await notifyNewLead(lead);
  } catch (e) {
    console.error('[notify] lead', e.message);
  }
  return successResponse(res, lead, emailed ? MSG_LEAD_OK_EMAIL : MSG_LEAD_OK, 201);
});

exports.createTestDrive = asyncHandler(async (req, res) => {
  const testDrive = await TestDrive.create(req.body);
  let emailed = false;
  try {
    emailed = await notifyNewTestDrive(testDrive);
  } catch (e) {
    console.error('[notify] test drive', e.message);
  }
  return successResponse(res, testDrive, emailed ? MSG_TD_OK_EMAIL : MSG_TD_OK, 201);
});

exports.createEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.create(req.body);
  let emailed = false;
  try {
    emailed = await notifyNewEnquiry(enquiry);
  } catch (e) {
    console.error('[notify] enquiry', e.message);
  }
  return successResponse(res, enquiry, emailed ? MSG_ENQ_OK_EMAIL : MSG_ENQ_OK, 201);
});
