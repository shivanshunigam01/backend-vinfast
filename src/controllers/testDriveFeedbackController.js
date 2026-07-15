const TestDriveFeedback = require('../models/TestDriveFeedback');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

const MSG_FEEDBACK_OK = 'Thank you! Your test-drive feedback has been submitted to Patliputra VinFast.';

exports.createTestDriveFeedback = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const doc = await TestDriveFeedback.create({
    name: body.name,
    mobile: body.mobile,
    city: body.city,
    model: body.model,
    testDriveDate: body.testDriveDate || undefined,
    salesConsultant: body.salesConsultant,
    leadSource: body.leadSource,
    purchaseIntent: body.purchaseIntent,
    mainConcern: body.mainConcern,
    comment: body.comment,
    ratings: body.ratings,
  });

  doc.reference = `TDF-${String(doc._id).slice(-6).toUpperCase()}`;
  await doc.save();

  return successResponse(
    res,
    { id: doc._id, reference: doc.reference },
    MSG_FEEDBACK_OK,
    201
  );
});
