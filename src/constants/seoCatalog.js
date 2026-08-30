/**
 * SEO catalog for the model line-up sold by Patliputra VinFast.
 *
 * Model master for Bihar SEO. District hubs live at `/{districtSlug}`.
 * Selective VF 6 / VF 7 A- pages live at `/{districtSlug}/{modelSlug}`
 * for 12 high-demand districts only.
 *
 * `priceKey` / `rangeKey` point at SiteConfig fields so generated copy always
 * uses the price currently configured in the admin panel.
 */
const SEO_MODELS = [
  {
    key: 'vf6',
    slug: 'vinfast-vf6',
    name: 'VinFast VF6',
    shortName: 'VF6',
    bodyType: 'Electric SUV',
    seats: 5,
    variants: ['Earth', 'Wind', 'Wind Infinity'],
    priceKey: 'vf6Price',
    rangeKey: 'vf6Range',
    positioning: 'a smart, feature-loaded electric SUV built for city driving and family use',
    primaryKeywords: [
      'VinFast VF6',
      'VinFast VF6 Price Bihar',
      'Buy VinFast VF6',
      'VinFast VF6 Booking',
      'VinFast VF6 Test Drive',
      'VinFast VF6 Review',
      'VinFast VF6 Range',
      'VinFast VF6 Specifications',
      'VinFast VF6 Features',
      'VinFast VF6 On Road Price',
    ],
    intentKeywords: [
      'Best Electric SUV under 20 lakh',
      'Premium Electric SUV Bihar',
      'Family Electric SUV',
      'EV SUV with longest range',
      'Smart Electric SUV',
    ],
  },
  {
    key: 'vf7',
    slug: 'vinfast-vf7',
    name: 'VinFast VF7',
    shortName: 'VF7',
    bodyType: 'Premium Electric SUV',
    seats: 5,
    variants: ['Earth', 'Wind', 'Wind Infinity', 'Sky', 'Sky Infinity'],
    priceKey: 'vf7Price',
    rangeKey: 'vf7Range',
    positioning: 'a premium electric SUV with ADAS, connected technology and long-range performance',
    primaryKeywords: [
      'VinFast VF7',
      'VinFast VF7 Price',
      'VinFast VF7 Bihar',
      'VinFast VF7 Booking',
      'VinFast VF7 Test Drive',
      'VinFast VF7 Review',
      'VinFast VF7 Range',
      'VinFast VF7 ADAS',
      'VinFast VF7 Interior',
      'VinFast VF7 On Road Price',
    ],
    intentKeywords: [
      'Premium Electric SUV India',
      'Luxury EV SUV',
      'ADAS Electric SUV',
      'Connected Electric SUV',
      'Electric SUV with panoramic roof',
    ],
  },
  {
    key: 'mpv7',
    slug: 'vinfast-mpv7',
    name: 'VinFast VF MPV7',
    shortName: 'MPV7',
    bodyType: 'Electric MPV',
    seats: 7,
    variants: ['Standard'],
    priceKey: 'mpv7Price',
    rangeKey: 'mpv7Range',
    positioning: 'a spacious 7-seater electric MPV designed for large families and corporate fleets',
    primaryKeywords: [
      'VinFast MPV7',
      'VinFast MPV7 Price',
      'VinFast MPV7 Booking',
      'VinFast MPV7 Review',
      'VinFast MPV7 Features',
      'VinFast MPV7 Range',
      '7 Seater Electric Car',
      'VinFast VF MPV7 Bihar',
    ],
    intentKeywords: [
      'Best Electric MPV',
      'Premium Family EV',
      'Electric Car for Large Family',
      'Executive Electric MPV',
      'Electric Car for Corporate Use',
    ],
  },
  {
    key: 'limo-green',
    slug: 'vinfast-limo-green',
    name: 'VinFast Limo Green',
    shortName: 'Limo Green',
    bodyType: 'Electric MPV',
    seats: 7,
    variants: ['Standard'],
    priceKey: 'limoGreenPrice',
    rangeKey: 'limoGreenRange',
    positioning: 'a premium 7-seater electric MPV built for executive travel, fleets and long family journeys',
    primaryKeywords: [
      'VinFast Limo Green',
      'VinFast Limo Green Price',
      'VinFast Limo Green Bihar',
      'VinFast Limo Green Booking',
      'VinFast Limo Green Review',
      'VinFast Limo Green Range',
      'Limo Green 7 Seater EV',
      'VinFast Limo Green Test Drive',
    ],
    intentKeywords: [
      'Electric MPV for taxi fleet',
      'Premium Electric MPV India',
      '7 Seater EV for business',
      'Electric people carrier',
      'Fleet Electric MPV Bihar',
    ],
  },
];

/**
 * District-level dealer/category keywords ({district} is replaced with the
 * district name). Applied to every district page in addition to model keywords.
 */
const DISTRICT_KEYWORD_TEMPLATES = [
  'VinFast Dealer {district}',
  'VinFast Showroom {district}',
  'Electric SUV {district}',
  'Premium EV {district}',
  'Electric Car Showroom {district}',
  'EV Showroom {district}',
  'Electric SUV Test Drive {district}',
  'Buy Electric SUV {district}',
  'Electric Car Price {district}',
];

/**
 * Static site routes included in the sitemap. Every path here MUST exist as a
 * live route in career-section-nanak/src/App.tsx — a sitemap that lists 404s
 * hurts crawl trust. Add new content pages here as they ship.
 */
const STATIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/vinfast-vf6', priority: 0.9, changefreq: 'weekly' },
  { path: '/vinfast-vf7', priority: 0.9, changefreq: 'weekly' },
  { path: '/vinfast-mpv7', priority: 0.9, changefreq: 'weekly' },
  { path: '/vinfast-limo-green', priority: 0.9, changefreq: 'weekly' },
  { path: '/models/vf6', priority: 0.9, changefreq: 'weekly' },
  { path: '/models/vf7', priority: 0.9, changefreq: 'weekly' },
  { path: '/models/mpv7', priority: 0.9, changefreq: 'weekly' },
  { path: '/models/limo-green', priority: 0.9, changefreq: 'weekly' },
  { path: '/compare-models', priority: 0.8, changefreq: 'weekly' },
  { path: '/compare', priority: 0.7, changefreq: 'weekly' },
  { path: '/compare/vinfast-vf6-vs-tata-curvv-ev', priority: 0.7, changefreq: 'monthly' },
  { path: '/compare/vinfast-vf6-vs-mahindra-be-6', priority: 0.7, changefreq: 'monthly' },
  { path: '/compare/vinfast-vf6-vs-mg-zs-ev', priority: 0.7, changefreq: 'monthly' },
  { path: '/compare/vinfast-vf7-vs-byd-atto-3', priority: 0.7, changefreq: 'monthly' },
  { path: '/compare/vinfast-vf7-vs-hyundai-creta-electric', priority: 0.7, changefreq: 'monthly' },
  { path: '/compare/vinfast-vf7-vs-mahindra-xev-9e', priority: 0.7, changefreq: 'monthly' },
  { path: '/ev-buying-guide', priority: 0.7, changefreq: 'monthly' },
  { path: '/emi-calculator', priority: 0.8, changefreq: 'monthly' },
  { path: '/charging-calculator', priority: 0.7, changefreq: 'monthly' },
  { path: '/running-cost-calculator', priority: 0.7, changefreq: 'monthly' },
  { path: '/test-drive', priority: 0.9, changefreq: 'weekly' },
  { path: '/book-now', priority: 0.8, changefreq: 'weekly' },
  { path: '/charging-infrastructure', priority: 0.7, changefreq: 'monthly' },
  { path: '/ownership-experience', priority: 0.6, changefreq: 'monthly' },
  { path: '/customer-stories', priority: 0.6, changefreq: 'weekly' },
  { path: '/blogs', priority: 0.7, changefreq: 'daily' },
  { path: '/blogs/vf6-vs-vf7-bihar', priority: 0.7, changefreq: 'monthly' },
  { path: '/blogs/ev-running-cost-bihar', priority: 0.7, changefreq: 'monthly' },
  { path: '/blogs/home-ev-charging-bihar', priority: 0.7, changefreq: 'monthly' },
  { path: '/blogs/patna-to-gaya-ev-trip', priority: 0.7, changefreq: 'monthly' },
  { path: '/blogs/patna-to-darbhanga-ev-trip', priority: 0.6, changefreq: 'monthly' },
  { path: '/blogs/vf6-ownership-guide-bihar', priority: 0.6, changefreq: 'monthly' },
  { path: '/blogs/vf7-highway-guide-bihar', priority: 0.6, changefreq: 'monthly' },
  { path: '/blogs/electric-suv-buying-checklist-bihar', priority: 0.6, changefreq: 'monthly' },
  { path: '/blogs/prepare-home-ev-charger-bihar', priority: 0.5, changefreq: 'monthly' },
  { path: '/blogs/bihar-owner-stories', priority: 0.5, changefreq: 'monthly' },
  { path: '/blogs/ev-monsoon-bihar', priority: 0.5, changefreq: 'monthly' },
  { path: '/blogs/7-seater-ev-bihar', priority: 0.5, changefreq: 'monthly' },
  { path: '/faq', priority: 0.7, changefreq: 'weekly' },
  { path: '/bihar', priority: 0.8, changefreq: 'weekly' },
  { path: '/about', priority: 0.6, changefreq: 'monthly' },
  { path: '/contact', priority: 0.8, changefreq: 'monthly' },
  { path: '/privacy-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/terms-of-service', priority: 0.3, changefreq: 'yearly' },
  { path: '/terms-and-conditions', priority: 0.3, changefreq: 'yearly' },
  { path: '/payment-refund-policy', priority: 0.3, changefreq: 'yearly' },
];

const modelByKey = new Map(SEO_MODELS.map((m) => [m.key, m]));
const modelBySlug = new Map(SEO_MODELS.map((m) => [m.slug, m]));

function getSeoModelByKey(key) {
  return modelByKey.get(String(key || '').toLowerCase()) || null;
}

function getSeoModelBySlug(slug) {
  return modelBySlug.get(String(slug || '').toLowerCase()) || null;
}

module.exports = {
  SEO_MODELS,
  DISTRICT_KEYWORD_TEMPLATES,
  STATIC_ROUTES,
  getSeoModelByKey,
  getSeoModelBySlug,
};
