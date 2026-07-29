const DistrictPage = require('../models/DistrictPage');
const SiteConfig = require('../models/SiteConfig');
const DealerSettings = require('../models/DealerSettings');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildSitemapXml, buildRobotsTxt } = require('../utils/sitemap');
const { BIHAR_DISTRICTS } = require('../constants/biharDistricts');
const { SEO_MODELS, getSeoModelByKey } = require('../constants/seoCatalog');
const {
  organizationSchema,
  autoDealerSchema,
  websiteSchema,
  vehicleSchema,
  faqSchema,
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

/** GET /llms.txt — AI agent (AEO) discovery file, mirrors the frontend static copy. */
exports.getLlmsTxt = asyncHandler(async (req, res) => {
  const dealer = (await DealerSettings.findOne().lean()) || {};
  const lines = [
    '# Patliputra VinFast',
    '',
    "> Bihar's first authorised VinFast electric vehicle dealership, located in Patna,",
    '> Bihar, India. We sell, service and support the full VinFast EV lineup for',
    '> customers across all 38 districts of Bihar.',
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
    `- EV Buying Guide: ${absoluteUrl('/ev-buying-guide')}`,
    `- FAQs: ${absoluteUrl('/faq')}`,
    `- Book a test drive: ${absoluteUrl('/test-drive')}`,
    `- District pages: ${absoluteUrl('/{district}/{model}')} (e.g. ${absoluteUrl('/patna/vinfast-vf6')})`,
    '',
  ];
  res.set('Content-Type', 'text/plain').set('Cache-Control', 'public, max-age=3600').send(lines.join('\n'));
});

/**
 * GET /public/seo/global — site-wide SEO payload for every page:
 * default meta, Google verification token, Organization / AutoDealer /
 * WebSite JSON-LD. The frontend injects this once in the app shell.
 */
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
      "Patliputra VinFast — Bihar's #1 Organic Destination for Premium Electric Vehicles | VF6, VF7, MPV7",
    defaultMetaDescription:
      cfg.defaultMetaDescription ||
      "Patliputra VinFast is Bihar's authorised destination for premium VinFast EV search & purchase. Explore VF6, VF7, VF MPV7 and Limo Green — prices, test drives, finance, charging and service across all 38 districts.",
    googleSiteVerification: cfg.googleSiteVerification || null,
    schemas: [organizationSchema(dlr), autoDealerSchema(dlr), websiteSchema(dlr)],
  });
});

/** GET /public/seo/districts — the 38 districts (for footers, menus, routing). */
exports.getDistricts = asyncHandler(async (req, res) => {
  return successResponse(
    res,
    BIHAR_DISTRICTS.map((d) => ({ name: d.name, slug: d.slug }))
  );
});

/** GET /public/seo/models — SEO model catalog (slugs, variants, keywords). */
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

/**
 * GET /public/seo/district-pages — slim list of active pages, used by the
 * frontend router to know which /{district}/{model} paths exist.
 * Optional filters: ?district=patna & ?model=vf6
 */
exports.listDistrictPages = asyncHandler(async (req, res) => {
  const query = { active: true };
  if (req.query.district) query.districtSlug = String(req.query.district).toLowerCase();
  if (req.query.model) query.modelKey = String(req.query.model).toLowerCase();

  const pages = await DistrictPage.find(query)
    .select('path districtSlug districtName modelKey modelName metaTitle')
    .sort({ districtSlug: 1, modelKey: 1 })
    .lean();

  return successResponse(res, pages);
});

/**
 * GET /public/seo/district-pages/:districtSlug/:modelSlugOrKey — full landing
 * page payload: content, keywords, FAQs and ready-to-inject JSON-LD schemas
 * (Vehicle, FAQPage, BreadcrumbList, AutoDealer scoped to the district).
 */
exports.getDistrictPage = asyncHandler(async (req, res) => {
  const districtSlug = String(req.params.districtSlug || '').toLowerCase();
  const modelParam = String(req.params.modelSlug || '').toLowerCase();
  // Accept both the model key ("vf6") and the URL slug ("vinfast-vf6").
  const model =
    getSeoModelByKey(modelParam) || SEO_MODELS.find((m) => m.slug === modelParam) || null;
  if (!model) throw new ApiError(404, 'Page not found');

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
  const cfg = siteConfig || {};

  const schemas = [
    autoDealerSchema(dealer || {}, page.districtName),
    vehicleSchema(model, {
      price: model.priceKey ? cfg[model.priceKey] : null,
      range: model.rangeKey ? cfg[model.rangeKey] : null,
      url: absoluteUrl(page.path),
    }),
    faqSchema(page.faqs),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: page.modelName, path: `/models/${model.key === 'limo-green' ? 'limo-green' : model.key}` },
      { name: `${page.modelName} in ${page.districtName}`, path: page.path },
    ]),
  ].filter(Boolean);

  return successResponse(res, {
    ...page,
    canonicalUrl: absoluteUrl(page.path),
    schemas,
  });
});
