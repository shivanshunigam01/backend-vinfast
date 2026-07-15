const PostDeliveryFeedback = require('../models/PostDeliveryFeedback');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

const MSG_FEEDBACK_OK = 'Thank you! Your feedback has been submitted to Patliputra VinFast.';

exports.createPostDeliveryFeedback = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const doc = await PostDeliveryFeedback.create({
    name: body.name,
    mobile: body.mobile,
    model: body.model,
    colour: body.colour,
    deliveryDate: body.deliveryDate || undefined,
    leadSource: body.leadSource,
    comment: body.comment,
    ratings: body.ratings,
  });

  doc.reference = `FB-${String(doc._id).slice(-6).toUpperCase()}`;
  await doc.save();

  return successResponse(
    res,
    { id: doc._id, reference: doc.reference },
    MSG_FEEDBACK_OK,
    201
  );
});
