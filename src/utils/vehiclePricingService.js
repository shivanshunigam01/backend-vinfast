const VehiclePricing = require('../models/VehiclePricing');
const SiteConfig = require('../models/SiteConfig');
const Product = require('../models/Product');
const { buildDefaultPricingDocs, SLUG_ORDER } = require('./vehiclePricingDefaults');

const SITE_CONFIG_FIELD_BY_SLUG = {
  vf6: { price: 'vf6Price', range: 'vf6Range' },
  vf7: { price: 'vf7Price', range: 'vf7Range' },
  mpv7: { price: 'mpv7Price' },
  'limo-green': { price: 'limoGreenPrice' },
};

/** Product slug aliases that should receive priceFrom when a pricing slug is updated. */
const PRODUCT_SLUG_ALIASES = {
  vf6: ['vf6', 'vf-6', 'vinfast-vf6'],
  vf7: ['vf7', 'vf-7', 'vinfast-vf7'],
  mpv7: ['mpv7', 'mpv-7', 'vinfast-mpv7'],
  'limo-green': ['limo-green', 'limo green', 'limogreen', 'limo_green', 'vinfast-limo-green'],
};

function sortBySlugOrder(docs) {
  const rank = new Map(SLUG_ORDER.map((s, i) => [s, i]));
  return [...docs].sort((a, b) => {
    const ra = rank.has(a.slug) ? rank.get(a.slug) : 999;
    const rb = rank.has(b.slug) ? rank.get(b.slug) : 999;
    return ra - rb || String(a.slug).localeCompare(String(b.slug));
  });
}

function normalizeVariantList(variants) {
  if (!Array.isArray(variants)) return undefined;
  return variants.map((v, index) => ({
    id: String(v.id || '').trim(),
    label: String(v.label || '').trim(),
    price: v.price !== undefined ? String(v.price).trim() : '',
    order: Number.isFinite(Number(v.order)) ? Number(v.order) : index,
    active: v.active !== false,
  }));
}

async function ensureDefaultPricing() {
  const siteConfig = await SiteConfig.findOne().lean();
  const defaults = buildDefaultPricingDocs(siteConfig);
  for (const def of defaults) {
    const exists = await VehiclePricing.exists({ slug: def.slug });
    if (!exists) {
      await VehiclePricing.create(def);
    }
  }
}

async function listPricing({ activeOnly = false } = {}) {
  await ensureDefaultPricing();
  const filter = activeOnly ? { active: true } : {};
  const docs = await VehiclePricing.find(filter).lean();
  return sortBySlugOrder(docs);
}

async function getBySlug(slug) {
  await ensureDefaultPricing();
  const normalized = String(slug || '').trim().toLowerCase();
  return VehiclePricing.findOne({ slug: normalized }).lean();
}

/**
 * Push priceFrom / range into SiteConfig + matching Product documents.
 */
async function syncSiteConfigAndProducts(doc) {
  if (!doc || !doc.slug) return;

  const fields = SITE_CONFIG_FIELD_BY_SLUG[doc.slug];
  if (fields) {
    const $set = {};
    if (fields.price && doc.priceFrom !== undefined && doc.priceFrom !== null) {
      $set[fields.price] = String(doc.priceFrom);
    }
    if (fields.range && doc.range !== undefined && doc.range !== null) {
      $set[fields.range] = String(doc.range);
    }
    if (Object.keys($set).length) {
      let site = await SiteConfig.findOne();
      if (!site) {
        site = await SiteConfig.create($set);
      } else {
        Object.assign(site, $set);
        await site.save();
      }
    }
  }

  const aliases = PRODUCT_SLUG_ALIASES[doc.slug] || [doc.slug];
  const slugMatchers = aliases.map((a) => String(a).toLowerCase());
  if (doc.priceFrom !== undefined && doc.priceFrom !== null) {
    await Product.updateMany(
      { slug: { $in: slugMatchers } },
      { $set: { priceFrom: String(doc.priceFrom) } }
    );
  }
}

async function updatePricing(slug, body = {}) {
  await ensureDefaultPricing();
  const normalized = String(slug || '').trim().toLowerCase();
  const doc = await VehiclePricing.findOne({ slug: normalized });
  if (!doc) {
    const err = new Error(`Vehicle pricing not found for slug: ${normalized}`);
    err.statusCode = 404;
    throw err;
  }

  if (body.name !== undefined) doc.name = String(body.name).trim();
  if (body.priceFrom !== undefined) doc.priceFrom = String(body.priceFrom).trim();
  if (body.range !== undefined) doc.range = String(body.range).trim();
  if (body.active !== undefined) doc.active = Boolean(body.active);

  if (body.variants !== undefined) {
    const variants = normalizeVariantList(body.variants);
    if (!variants) {
      const err = new Error('variants must be an array');
      err.statusCode = 400;
      throw err;
    }
    for (const v of variants) {
      if (!v.id || !v.label) {
        const err = new Error('Each variant requires id and label');
        err.statusCode = 400;
        throw err;
      }
    }
    doc.variants = variants;
  }

  await doc.save();
  await syncSiteConfigAndProducts(doc);
  return doc.toObject();
}

module.exports = {
  ensureDefaultPricing,
  listPricing,
  getBySlug,
  updatePricing,
  syncSiteConfigAndProducts,
  PRODUCT_SLUG_ALIASES,
  SITE_CONFIG_FIELD_BY_SLUG,
};
