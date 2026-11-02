const ModelPageContent = require('../models/ModelPageContent');
const { MODEL_PAGE_SLUGS } = require('../models/ModelPageContent');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

function assertValidSlug(slug) {
  if (!MODEL_PAGE_SLUGS.includes(slug)) {
    throw new ApiError(400, `Invalid model page slug. Allowed: ${MODEL_PAGE_SLUGS.join(', ')}`);
  }
}

function normalizeFeatures(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const layout = item?.layout === 'wide' ? 'wide' : 'standard';
      const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : index;
      return {
        imageUrl: String(item?.imageUrl || '').trim(),
        title: String(item?.title || '').trim(),
        description: String(item?.description || '').trim(),
        alt: String(item?.alt || '').trim() || String(item?.title || '').trim(),
        layout,
        order,
        active: item?.active !== false,
      };
    })
    .filter((item) => item.title)
    .sort((a, b) => a.order - b.order || 0);
}

function toPublicPayload(doc) {
  const features = (doc.features || [])
    .filter((f) => f.active !== false)
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      id: String(f._id),
      imageUrl: f.imageUrl,
      title: f.title,
      description: f.description,
      alt: f.alt,
      layout: f.layout,
      order: f.order,
    }));
  return {
    slug: doc.slug,
    galleryLabel: doc.galleryLabel,
    galleryTitle: doc.galleryTitle,
    galleryIntro: doc.galleryIntro,
    features,
  };
}

exports.listAdmin = asyncHandler(async (req, res) => {
  const docs = await ModelPageContent.find({}).sort({ slug: 1 });
  return successResponse(
    res,
    docs.map((d) => toPublicPayload(d)),
  );
});

exports.getAdminBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  assertValidSlug(slug);
  const doc = await ModelPageContent.findOne({ slug });
  if (!doc) throw new ApiError(404, 'Model page content not found');
  return successResponse(res, {
    ...toPublicPayload(doc),
    features: (doc.features || [])
      .sort((a, b) => a.order - b.order)
      .map((f) => ({
        id: String(f._id),
        imageUrl: f.imageUrl,
        title: f.title,
        description: f.description,
        alt: f.alt,
        layout: f.layout,
        order: f.order,
        active: f.active !== false,
      })),
  });
});

exports.upsertBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  assertValidSlug(slug);
  const features = normalizeFeatures(req.body?.features);
  if (features.length === 0) {
    throw new ApiError(400, 'At least one feature with a title is required');
  }
  const payload = {
    slug,
    galleryLabel: String(req.body?.galleryLabel || 'Gallery').trim() || 'Gallery',
    galleryTitle: String(req.body?.galleryTitle || '').trim(),
    galleryIntro: String(req.body?.galleryIntro || '').trim(),
    features,
  };
  const doc = await ModelPageContent.findOneAndUpdate({ slug }, payload, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  return successResponse(res, toPublicPayload(doc), 'Model page gallery saved');
});

exports.getPublicBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  assertValidSlug(slug);
  const doc = await ModelPageContent.findOne({ slug });
  if (!doc || !(doc.features || []).some((f) => f.active !== false)) {
    throw new ApiError(404, 'Model page content not found');
  }
  return successResponse(res, toPublicPayload(doc));
});
