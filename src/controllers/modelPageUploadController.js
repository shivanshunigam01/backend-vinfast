const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { MODEL_PAGE_SLUGS } = require('../models/ModelPageContent');
const { publicRequestOrigin } = require('../utils/uploadPaths');

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

exports.uploadModelPageImage = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  if (!MODEL_PAGE_SLUGS.includes(slug)) {
    throw new ApiError(400, `Invalid model page slug. Allowed: ${MODEL_PAGE_SLUGS.join(', ')}`);
  }
  if (!req.file?.filename) {
    throw new ApiError(400, 'Image file is required (form field name: image)');
  }

  const origin = publicRequestOrigin(req);
  const url = `${origin}/uploads/model-pages/${slug}/${req.file.filename}`;

  return successResponse(
    res,
    {
      url,
      slug,
      filename: req.file.filename,
      size: req.file.size,
    },
    'Image uploaded to server',
    201,
  );
});
