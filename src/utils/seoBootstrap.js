const DistrictPage = require('../models/DistrictPage');
const SiteConfig = require('../models/SiteConfig');
const { BIHAR_DISTRICTS, A_TIER_SLUGS, isIndexableATierPage } = require('../constants/biharDistricts');
const { SEO_MODELS } = require('../constants/seoCatalog');
const { generateHubPageContent, generateATierPageContent, HUB_MODEL_KEY } = require('./seoContent');

/**
 * Ensures 38 district hubs + 24 A- (VF 6 / VF 7) pages exist, and deactivates
 * leftover mass-generated district × model documents.
 */
async function ensureDistrictPages({ force = false } = {}) {
  const siteConfig = (await SiteConfig.findOne().lean()) || {};
  const existing = await DistrictPage.find().select('districtSlug modelKey customized pageType').lean();
  const existingByCombo = new Map(existing.map((p) => [`${p.districtSlug}:${p.modelKey}`, p]));

  const ops = [];
  let created = 0;
  let regenerated = 0;
  let skipped = 0;

  function queue(combo, content) {
    const current = existingByCombo.get(combo);
    if (current && !force) {
      skipped += 1;
      return;
    }
    if (current && current.customized) {
      skipped += 1;
      return;
    }
    ops.push({
      updateOne: {
        filter: { districtSlug: content.districtSlug, modelKey: content.modelKey },
        update: { $set: { ...content, active: true }, $setOnInsert: { customized: false } },
        upsert: true,
      },
    });
    if (current) regenerated += 1;
    else created += 1;
  }

  for (const district of BIHAR_DISTRICTS) {
    queue(`${district.slug}:${HUB_MODEL_KEY}`, generateHubPageContent(district, siteConfig));
    if (!district.aTier) continue;
    for (const model of SEO_MODELS.filter((m) => m.key === 'vf6' || m.key === 'vf7')) {
      queue(`${district.slug}:${model.key}`, generateATierPageContent(district, model, siteConfig));
    }
  }

  if (ops.length) await DistrictPage.bulkWrite(ops, { ordered: false });

  const deactivate = await DistrictPage.updateMany(
    {
      $nor: [
        { modelKey: HUB_MODEL_KEY },
        { pageType: 'hub' },
        {
          modelKey: { $in: ['vf6', 'vf7'] },
          districtSlug: { $in: A_TIER_SLUGS },
        },
      ],
    },
    { $set: { active: false } }
  );

  const totalActive = await DistrictPage.countDocuments({ active: true });
  return {
    created,
    regenerated,
    skipped,
    deactivated: deactivate.modifiedCount || 0,
    totalActive,
    aTierDistricts: A_TIER_SLUGS.length,
    expectedActive: BIHAR_DISTRICTS.length + A_TIER_SLUGS.length * 2,
  };
}

async function ensureSeoReady() {
  const result = await ensureDistrictPages();
  if (result.created > 0 || result.deactivated > 0) {
    console.log(
      `[SEO bootstrap] hubs/A- created=${result.created} regenerated=${result.regenerated} deactivated=${result.deactivated} active=${result.totalActive}`,
    );
  }
  return result;
}

module.exports = { ensureDistrictPages, ensureSeoReady, isIndexableATierPage };
