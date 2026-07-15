const DistrictPage = require('../models/DistrictPage');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { ensureDistrictPages } = require('../utils/seoBootstrap');

const EDITABLE_FIELDS = [
  'metaTitle',
  'metaDescription',
  'h1',
  'intro',
  'sections',
  'keywords',
  'faqs',
  'active',
];

/**
 * GET /admin/seo/district-pages — full list (152 rows) with filters:
 * ?district=patna & ?model=vf6 & ?search=text & ?active=true|false
 */
exports.listDistrictPages = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.district) query.districtSlug = String(req.query.district).toLowerCase();
  if (req.query.model) query.modelKey = String(req.query.model).toLowerCase();
  if (req.query.active === 'true') query.active = true;
  if (req.query.active === 'false') query.active = false;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ districtName: rx }, { modelName: rx }, { metaTitle: rx }, { path: rx }];
  }

  const pages = await DistrictPage.find(query)
    .select('path districtSlug districtName modelKey modelName metaTitle active customized updatedAt')
    .sort({ districtSlug: 1, modelKey: 1 });

  return successResponse(res, pages);
});

/** GET /admin/seo/district-pages/:id */
exports.getDistrictPage = asyncHandler(async (req, res) => {
  const page = await DistrictPage.findById(req.params.id);
  if (!page) throw new ApiError(404, 'District page not found');
  return successResponse(res, page);
});

/**
 * PUT /admin/seo/district-pages/:id — edit page content. Marks the page as
 * `customized` so bulk regeneration won't overwrite manual edits.
 */
exports.updateDistrictPage = asyncHandler(async (req, res) => {
  const page = await DistrictPage.findById(req.params.id);
  if (!page) throw new ApiError(404, 'District page not found');

  let touchedContent = false;
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      page[field] = req.body[field];
      if (field !== 'active') touchedContent = true;
    }
  }
  if (touchedContent) page.customized = true;
  if (req.body.customized === false) page.customized = false;

  await page.save();
  return successResponse(res, page, 'District page updated');
});

/**
 * POST /admin/seo/district-pages/regenerate — recreate missing pages, and with
 * { force: true } also regenerate non-customized pages from current templates
 * and SiteConfig prices.
 */
exports.regenerateDistrictPages = asyncHandler(async (req, res) => {
  const force = req.body && req.body.force === true;
  const result = await ensureDistrictPages({ force });
  return successResponse(
    res,
    result,
    `Done: ${result.created} created, ${result.regenerated} regenerated, ${result.skipped} skipped`
  );
});
