const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { MARKETING_PAGE_SLUGS } = require('../models/MarketingPageContent');
const { cloudinaryConfigured, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

exports.uploadMarketingPageImage = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  if (!MARKETING_PAGE_SLUGS.includes(slug)) {
    throw new ApiError(400, `Invalid page slug. Allowed: ${MARKETING_PAGE_SLUGS.join(', ')}`);
  }
  if (!req.file?.buffer) {
    throw new ApiError(400, 'Image file is required (form field name: image)');
  }
  if (!cloudinaryConfigured()) {
    throw new ApiError(
      503,
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
    );
  }

  const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
    folder: `patliputra-vinfast/marketing-pages/${slug}`,
  });

  return successResponse(
    res,
    {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      slug,
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
    },
    'Image uploaded to Cloudinary',
    201,
  );
});
