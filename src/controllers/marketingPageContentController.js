const MarketingPageContent = require('../models/MarketingPageContent');
const { MARKETING_PAGE_SLUGS } = require('../models/MarketingPageContent');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

function assertValidSlug(slug) {
  if (!MARKETING_PAGE_SLUGS.includes(slug)) {
    throw new ApiError(400, `Invalid page slug. Allowed: ${MARKETING_PAGE_SLUGS.join(', ')}`);
  }
}

function normalizeHero(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const imageUrl = String(raw.imageUrl || '').trim();
  if (!imageUrl) return null;
  return {
    imageUrl,
    width: Number.isFinite(Number(raw.width)) && Number(raw.width) > 0 ? Number(raw.width) : 3840,
    height: Number.isFinite(Number(raw.height)) && Number(raw.height) > 0 ? Number(raw.height) : 2160,
    alt: String(raw.alt || '').trim(),
    imageFit: raw.imageFit === 'contain' ? 'contain' : 'cover',
    objectPosition: String(raw.objectPosition || 'center center').trim() || 'center center',
  };
}

function heroFromDoc(doc) {
  return normalizeHero(doc?.hero);
}

function toPublicPayload(doc) {
  const hero = heroFromDoc(doc);
  const payload = { slug: doc.slug };
  if (hero) payload.hero = hero;
  return payload;
}

exports.listAdmin = asyncHandler(async (req, res) => {
  const docs = await MarketingPageContent.find({}).sort({ slug: 1 });
  return successResponse(
    res,
    docs.map((d) => toPublicPayload(d)),
  );
});

exports.getAdminBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  assertValidSlug(slug);
  const doc = await MarketingPageContent.findOne({ slug });
  if (!doc) {
    return successResponse(res, { slug, hero: null });
  }
  return successResponse(res, toPublicPayload(doc));
});

exports.upsertBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  assertValidSlug(slug);
  const hero = normalizeHero(req.body?.hero);
  if (!hero) {
    throw new ApiError(400, 'Add a hero banner image before saving');
  }
  const doc = await MarketingPageContent.findOneAndUpdate(
    { slug },
    {
      slug,
      hero: {
        imageUrl: hero.imageUrl,
        width: hero.width,
        height: hero.height,
        alt: hero.alt,
        imageFit: hero.imageFit,
        objectPosition: hero.objectPosition,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
  return successResponse(res, toPublicPayload(doc), 'Page hero saved');
});

exports.getPublicBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  assertValidSlug(slug);
  const doc = await MarketingPageContent.findOne({ slug });
  const hero = heroFromDoc(doc);
  if (!hero) {
    throw new ApiError(404, 'Page hero not found');
  }
  return successResponse(res, { slug, hero });
});
