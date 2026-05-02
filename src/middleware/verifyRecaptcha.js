const asyncHandler = require('../utils/asyncHandler');
const { errorResponse } = require('../utils/apiResponse');
const { verifyRecaptchaResponse, stripRecaptchaFromBody } = require('../utils/recaptcha');

/** Verify Google reCAPTCHA token, then remove it from req.body before validators / persistence. */
module.exports = asyncHandler(async (req, res, next) => {
  const result = await verifyRecaptchaResponse(req.body?.recaptchaToken, req.ip);
  if (!result.ok) {
    return errorResponse(res, result.message, 400);
  }
  stripRecaptchaFromBody(req.body);
  next();
});
