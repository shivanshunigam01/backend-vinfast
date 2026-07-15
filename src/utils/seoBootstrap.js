const DistrictPage = require('../models/DistrictPage');
const SiteConfig = require('../models/SiteConfig');
const { BIHAR_DISTRICTS } = require('../constants/biharDistricts');
const { SEO_MODELS } = require('../constants/seoCatalog');
const { generateDistrictPageContent } = require('./seoContent');

/**
 * Ensures every district × model landing page exists (38 × 4 = 152).
 * - Missing combinations are created with generated content.
 * - With `force: true`, existing non-customized pages are regenerated too
 *   (admin-edited pages with `customized: true` are always left alone).
 *
 * Runs at server startup (see server.js) and via the admin regenerate endpoint.
 */
async function ensureDistrictPages({ force = false } = {}) {
  const siteConfig = (await SiteConfig.findOne().lean()) || {};
  const existing = await DistrictPage.find().select('districtSlug modelKey customized').lean();
  const existingByCombo = new Map(existing.map((p) => [`${p.districtSlug}:${p.modelKey}`, p]));

  const ops = [];
  let created = 0;
  let regenerated = 0;
  let skipped = 0;

  for (const district of BIHAR_DISTRICTS) {
    for (const model of SEO_MODELS) {
      const combo = `${district.slug}:${model.key}`;
      const current = existingByCombo.get(combo);

      if (current && !force) {
        skipped += 1;
        continue;
      }
      if (current && current.customized) {
        skipped += 1;
        continue;
      }

      const content = generateDistrictPageContent(district, model, siteConfig);
      ops.push({
        updateOne: {
          filter: { districtSlug: district.slug, modelKey: model.key },
          update: { $set: content, $setOnInsert: { active: true, customized: false } },
          upsert: true,
        },
      });
      if (current) regenerated += 1;
      else created += 1;
    }
  }

  if (ops.length) await DistrictPage.bulkWrite(ops, { ordered: false });

  const total = await DistrictPage.countDocuments();
  return { created, regenerated, skipped, total };
}

async function ensureSeoReady() {
  const result = await ensureDistrictPages();
  if (result.created > 0) {
    console.log(`[SEO bootstrap] created ${result.created} district landing pages (total ${result.total})`);
  }
  return result;
}

module.exports = { ensureDistrictPages, ensureSeoReady };
