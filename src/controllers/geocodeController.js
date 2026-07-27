const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { reverseGeocode } = require('../utils/reverseGeocode');

exports.reverseGeocode = asyncHandler(async (req, res) => {
  const lat = req.body?.lat ?? req.query?.lat;
  const lng = req.body?.lng ?? req.query?.lng;
  try {
    const result = await reverseGeocode(lat, lng);
    return successResponse(res, result);
  } catch (err) {
    throw new ApiError(err.statusCode || 500, err.message || 'Geocoding failed');
  }
});
