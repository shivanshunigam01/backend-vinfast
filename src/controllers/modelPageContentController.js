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

const { normalizeHeroFields } = require('../utils/modelPageHomeHero');

function normalizeHero(raw) {
  return normalizeHeroFields(raw);
}

function heroFromDoc(doc) {
  const normalized = normalizeHero(doc?.hero);
  if (normalized) return normalized;
  return null;
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
  const hero = heroFromDoc(doc);
  const payload = {
    slug: doc.slug,
    galleryLabel: doc.galleryLabel,
    galleryTitle: doc.galleryTitle,
    galleryIntro: doc.galleryIntro,
    features,
  };
  if (hero) payload.hero = hero;
  return payload;
}

function docHasPublicContent(doc) {
  if (!doc) return false;
  const hasFeatures = (doc.features || []).some((f) => f.active !== false && f.title);
  const hasHero = Boolean(heroFromDoc(doc));
  return hasFeatures || hasHero;
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
  const hero = normalizeHero(req.body?.hero);
  if (features.length === 0 && !hero) {
    throw new ApiError(400, 'Add a hero banner image or at least one gallery feature with a title');
  }
  const payload = {
    slug,
    galleryLabel: String(req.body?.galleryLabel || 'Gallery').trim() || 'Gallery',
    galleryTitle: String(req.body?.galleryTitle || '').trim(),
    galleryIntro: String(req.body?.galleryIntro || '').trim(),
    features,
  };
  if (req.body?.hero !== undefined) {
    payload.hero = hero || {
      imageUrl: '',
      width: 3840,
      height: 2160,
      alt: '',
      imageFit: 'cover',
      showcaseOnHomepage: false,
      homepageHeroOrder: 10,
      homepageHeroTitle: '',
      homepageHeroSubtitle: '',
      homepageHeroBadge: '',
      homepageObjectPosition: 'center center',
    };
  }
  const doc = await ModelPageContent.findOneAndUpdate({ slug }, payload, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  return successResponse(res, toPublicPayload(doc), 'Model page content saved');
});

exports.getPublicBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  assertValidSlug(slug);
  const doc = await ModelPageContent.findOne({ slug });
  if (!docHasPublicContent(doc)) {
    throw new ApiError(404, 'Model page content not found');
  }
  return successResponse(res, toPublicPayload(doc));
});
