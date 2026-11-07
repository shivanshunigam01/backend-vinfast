const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { cloudinaryConfigured, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

exports.uploadHomepageHeroImage = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'Image file is required (form field name: image)');
  }
  if (!cloudinaryConfigured()) {
    throw new ApiError(
      503,
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
    );
  }

  const variant = String(req.query.variant || 'desktop').toLowerCase() === 'mobile' ? 'mobile' : 'desktop';

  const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
    folder: `patliputra-vinfast/homepage-hero/${variant}`,
  });

  return successResponse(
    res,
    {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      variant,
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
    },
    'Homepage hero image uploaded',
    201,
  );
});
