const DistrictPage = require('../models/DistrictPage');
const { STATIC_ROUTES } = require('../constants/seoCatalog');
const { absoluteUrl } = require('./seoSchema');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ path, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${escapeXml(absoluteUrl(path))}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined) parts.push(`    <priority>${priority.toFixed(1)}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

/** Builds the full sitemap XML: static routes + all active district pages. */
async function buildSitemapXml() {
  const districtPages = await DistrictPage.find({ active: true })
    .select('path updatedAt')
    .sort({ path: 1 })
    .lean();

  const entries = [
    ...STATIC_ROUTES.map((r) =>
      urlEntry({ path: r.path, changefreq: r.changefreq, priority: r.priority })
    ),
    ...districtPages.map((p) =>
      urlEntry({ path: p.path, lastmod: p.updatedAt, changefreq: 'weekly', priority: 0.8 })
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

function buildRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    '',
  ].join('\n');
}

module.exports = { buildSitemapXml, buildRobotsTxt };
