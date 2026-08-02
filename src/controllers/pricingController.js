const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const {
  listPricing,
  getBySlug,
  updatePricing,
} = require('../utils/vehiclePricingService');
const { ALLOWED_SLUGS } = require('../models/VehiclePricing');

function assertValidSlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!ALLOWED_SLUGS.includes(normalized)) {
    throw new ApiError(400, `Invalid slug. Use one of: ${ALLOWED_SLUGS.join(', ')}`);
  }
  return normalized;
}

/** Admin: list all vehicle pricing (including inactive). */
exports.listAdmin = asyncHandler(async (req, res) => {
  const docs = await listPricing({ activeOnly: false });
  return successResponse(res, docs);
});

/** Admin: get one by slug. */
exports.getOne = asyncHandler(async (req, res) => {
  const slug = assertValidSlug(req.params.slug);
  const doc = await getBySlug(slug);
  if (!doc) throw new ApiError(404, 'Vehicle pricing not found');
  return successResponse(res, doc);
});

/** Admin: update one by slug (PUT). Syncs SiteConfig + Product.priceFrom. */
exports.updateOne = asyncHandler(async (req, res) => {
  const slug = assertValidSlug(req.params.slug);
  try {
    const doc = await updatePricing(slug, req.body || {});
    return successResponse(res, doc, 'Vehicle pricing updated');
  } catch (err) {
    if (err.statusCode) throw new ApiError(err.statusCode, err.message);
    throw err;
  }
});

/** Public: active pricing only. */
exports.listPublic = asyncHandler(async (req, res) => {
  const docs = await listPricing({ activeOnly: true });
  return successResponse(res, docs);
});
