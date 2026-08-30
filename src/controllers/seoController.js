const DistrictPage = require('../models/DistrictPage');
const SiteConfig = require('../models/SiteConfig');
const DealerSettings = require('../models/DealerSettings');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildSitemapXml, buildRobotsTxt } = require('../utils/sitemap');
const { BIHAR_DISTRICTS, getDistrictBySlug, isIndexableATierPage } = require('../constants/biharDistricts');
const { SEO_MODELS, getSeoModelByKey } = require('../constants/seoCatalog');
const { liveModelRows, HUB_MODEL_KEY } = require('../utils/seoContent');
const {
  organizationSchema,
  autoDealerSchema,
  websiteSchema,
  productSchema,
  breadcrumbSchema,
  absoluteUrl,
} = require('../utils/seoSchema');

/** GET /sitemap.xml — proxy this path from the frontend host to the API. */
exports.getSitemap = asyncHandler(async (req, res) => {
  const xml = await buildSitemapXml();
  res.set('Content-Type', 'application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
});

/** GET /robots.txt */
exports.getRobots = asyncHandler(async (req, res) => {
  res.set('Content-Type', 'text/plain').set('Cache-Control', 'public, max-age=3600').send(buildRobotsTxt());
});

/** GET /llms.txt — optional documentation for non-Google systems, not a ranking KPI. */
exports.getLlmsTxt = asyncHandler(async (req, res) => {
  const dealer = (await DealerSettings.findOne().lean()) || {};
  const lines = [
    '# Patliputra VinFast',
    '',
    "> Bihar's authorised VinFast electric vehicle dealership in Patna.",
    '> Sales, test-drive and service assistance for customers across 38 districts.',
    '> Physical showroom: Patna only (Paijawa, NH 30 Bypass).',
    '',
    `Company: ${dealer.dealerName || 'Patliputra VinFast'}`,
    `Location: ${dealer.address || 'Plot No. 2421, NH 30, Bypass Road, Paijawa, Patna, Bihar 800009, India'}`,
    `Phone: ${dealer.phone || '+91 92314 45060'}`,
    `Website: ${absoluteUrl('/')}`,
    '',
    '## Products',
    '',
    ...SEO_MODELS.map(
      (m) => `- ${m.name} — ${m.bodyType}, ${m.seats} seats. Variants: ${m.variants.join(', ')}.`,
    ),
    '',
    '## Key pages',
    '',
    `- Home: ${absoluteUrl('/')}`,
    ...SEO_MODELS.map((m) => `- ${m.name}: ${absoluteUrl(`/models/${m.key}`)}`),
    `- Compare models: ${absoluteUrl('/compare')}`,
    `- District hubs: ${absoluteUrl('/{district}')} (e.g. ${absoluteUrl('/gaya')})`,
    `- Book a test drive: ${absoluteUrl('/test-drive')}`,
    '',
  ];
  res.set('Content-Type', 'text/plain').set('Cache-Control', 'public, max-age=3600').send(lines.join('\n'));
});

exports.getGlobalSeo = asyncHandler(async (req, res) => {
  const [siteConfig, dealer] = await Promise.all([
    SiteConfig.findOne().lean(),
    DealerSettings.findOne().lean(),
  ]);
  const cfg = siteConfig || {};
  const dlr = dealer || {};

  return successResponse(res, {
    siteUrl: absoluteUrl('/'),
    defaultMetaTitle:
      cfg.defaultMetaTitle ||
      'VinFast Cars in Bihar | VF 6, VF 7, MPV 7 & Limo Green | Patliputra VinFast',
    defaultMetaDescription:
      cfg.defaultMetaDescription ||
      'Authorised VinFast dealer in Bihar. Explore VF 6, VF 7, MPV 7 and Limo Green — price, range, EMI and test drive assistance from Patliputra VinFast, Patna.',
    googleSiteVerification: cfg.googleSiteVerification || null,
    schemas: [organizationSchema(dlr), autoDealerSchema(dlr), websiteSchema(dlr)],
  });
});

exports.getDistricts = asyncHandler(async (req, res) => {
  return successResponse(
    res,
    BIHAR_DISTRICTS.map((d) => ({
      name: d.name,
      slug: d.slug,
      headquarters: d.headquarters,
      aTier: Boolean(d.aTier),
    }))
  );
});

exports.getSeoModels = asyncHandler(async (req, res) => {
  return successResponse(
    res,
    SEO_MODELS.map((m) => ({
      key: m.key,
      slug: m.slug,
      name: m.name,
      shortName: m.shortName,
      bodyType: m.bodyType,
      seats: m.seats,
      variants: m.variants,
    }))
  );
});

exports.listDistrictPages = asyncHandler(async (req, res) => {
  const query = { active: true };
  if (req.query.district) query.districtSlug = String(req.query.district).toLowerCase();
  if (req.query.model) query.modelKey = String(req.query.model).toLowerCase();
  if (req.query.pageType) query.pageType = String(req.query.pageType);

  const pages = await DistrictPage.find(query)
    .select('path districtSlug districtName modelKey modelName metaTitle pageType')
    .sort({ districtSlug: 1, modelKey: 1 })
    .lean();

  return successResponse(res, pages);
});

function attachLiveFields(page, { siteConfig, dealer, model }) {
  const cfg = siteConfig || {};
  const schemas = [
    organizationSchema(dealer || {}),
    autoDealerSchema(dealer || {}),
    model
      ? productSchema(model, {
          price: model.priceKey ? cfg[model.priceKey] : null,
          range: model.rangeKey ? cfg[model.rangeKey] : null,
          url: absoluteUrl(page.path),
        })
      : null,
    breadcrumbSchema(
      page.pageType === 'hub'
        ? [
            { name: 'Home', path: '/' },
            { name: 'Bihar', path: '/bihar' },
            { name: page.districtName, path: page.path },
          ]
        : [
            { name: 'Home', path: '/' },
            { name: page.districtName, path: `/${page.districtSlug}` },
            { name: page.modelName, path: page.path },
          ],
    ),
  ].filter(Boolean);

  return {
    ...page,
    modelsTable: liveModelRows(cfg),
    lastUpdated: page.updatedAt,
    canonicalUrl: absoluteUrl(page.path),
    schemas,
  };
}

exports.getDistrictHub = asyncHandler(async (req, res) => {
  const districtSlug = String(req.params.districtSlug || '').toLowerCase();
  if (!getDistrictBySlug(districtSlug)) throw new ApiError(404, 'Page not found');

  const page = await DistrictPage.findOne({
    districtSlug,
    modelKey: HUB_MODEL_KEY,
    active: true,
  }).lean();
  if (!page) throw new ApiError(404, 'Page not found');

  const [siteConfig, dealer] = await Promise.all([
    SiteConfig.findOne().lean(),
    DealerSettings.findOne().lean(),
  ]);

  return successResponse(res, attachLiveFields(page, { siteConfig, dealer, model: null }));
});

exports.getDistrictPage = asyncHandler(async (req, res) => {
  const districtSlug = String(req.params.districtSlug || '').toLowerCase();
  const modelParam = String(req.params.modelSlug || '').toLowerCase();
  const model =
    getSeoModelByKey(modelParam) || SEO_MODELS.find((m) => m.slug === modelParam) || null;
  if (!model) throw new ApiError(404, 'Page not found');
  if (!isIndexableATierPage(districtSlug, model.key)) throw new ApiError(404, 'Page not found');

  const page = await DistrictPage.findOne({
    districtSlug,
    modelKey: model.key,
    active: true,
  }).lean();
  if (!page) throw new ApiError(404, 'Page not found');

  const [siteConfig, dealer] = await Promise.all([
    SiteConfig.findOne().lean(),
    DealerSettings.findOne().lean(),
  ]);

  return successResponse(res, attachLiveFields(page, { siteConfig, dealer, model }));
});
