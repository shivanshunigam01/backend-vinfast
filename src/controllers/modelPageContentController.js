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

function normalizeColorShades(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : index;
      return {
        name: String(item?.name || '').trim(),
        hex: String(item?.hex || '#888888').trim() || '#888888',
        imageUrl: String(item?.imageUrl || '').trim(),
        alt: String(item?.alt || '').trim(),
        order,
        active: item?.active !== false,
      };
    })
    .filter((item) => item.name && item.imageUrl)
    .sort((a, b) => a.order - b.order || 0);
}

function colorShadesFromDoc(doc) {
  return (doc?.colorShades || [])
    .filter((s) => s.active !== false && s.name && s.imageUrl)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: String(s._id),
      name: s.name,
      hex: s.hex,
      imageUrl: s.imageUrl,
      alt: s.alt || s.name,
      order: s.order,
      active: s.active !== false,
    }));
}

function colorShadesAdminFromDoc(doc) {
  return (doc?.colorShades || [])
    .sort((a, b) => a.order - b.order)
    .map((s, index) => ({
      id: String(s._id),
      name: String(s.name || '').trim(),
      hex: String(s.hex || '#888888').trim() || '#888888',
      imageUrl: String(s.imageUrl || '').trim(),
      alt: String(s.alt || '').trim(),
      order: Number.isFinite(Number(s.order)) ? Number(s.order) : index,
      active: s.active !== false,
    }));
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
  const colorShades = colorShadesFromDoc(doc);
  const payload = {
    slug: doc.slug,
    galleryLabel: doc.galleryLabel,
    galleryTitle: doc.galleryTitle,
    galleryIntro: doc.galleryIntro,
    colorStudioIntro: String(doc.colorStudioIntro || '').trim(),
    colorShades,
    features,
  };
  if (hero) payload.hero = hero;
  return payload;
}

function docHasPublicContent(doc) {
  if (!doc) return false;
  const hasFeatures = (doc.features || []).some((f) => f.active !== false && f.title);
  const hasHero = Boolean(heroFromDoc(doc));
  const hasColorShades = colorShadesFromDoc(doc).length > 0;
  return hasFeatures || hasHero || hasColorShades;
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
    colorShades: colorShadesAdminFromDoc(doc),
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
  const colorShades = normalizeColorShades(req.body?.colorShades);
  if (features.length === 0 && !hero && colorShades.length === 0) {
    throw new ApiError(400, 'Add a hero image, gallery feature, or colour shade image');
  }
  const payload = {
    slug,
    galleryLabel: String(req.body?.galleryLabel || 'Gallery').trim() || 'Gallery',
    galleryTitle: String(req.body?.galleryTitle || '').trim(),
    galleryIntro: String(req.body?.galleryIntro || '').trim(),
    colorStudioIntro: String(req.body?.colorStudioIntro || '').trim(),
    colorShades,
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
