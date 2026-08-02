/**
 * Default vehicle pricing — synced with compareCatalog.ts / ModelVF6 variantExShowroomPrice.
 * VF6 Wind Infinity: ₹19,19,000* (compareCatalog id "infinity"; seed id windInfinity).
 */

const FALLBACK_MPV7_PRICE = '₹19.99 Lakh*';

/** Static defaults; mpv7.priceFrom may be overridden from SiteConfig at ensure time. */
const VEHICLE_PRICING_DEFAULTS = [
  {
    slug: 'vf6',
    name: 'VF 6',
    priceFrom: '₹18,19,000*',
    range: '468 km',
    active: true,
    variants: [
      { id: 'earth', label: 'Earth', price: '₹18,19,000*', order: 0, active: true },
      { id: 'wind', label: 'Wind', price: '₹18,69,000*', order: 1, active: true },
      { id: 'infinity', label: 'Wind Infinity', price: '₹19,19,000*', order: 2, active: true },
    ],
  },
  {
    slug: 'vf7',
    name: 'VF 7',
    priceFrom: '₹22,99,000*',
    range: '532 km',
    active: true,
    variants: [
      { id: 'earth', label: 'Earth', price: '₹22,99,000*', order: 0, active: true },
      { id: 'wind', label: 'Wind', price: '₹24,69,000*', order: 1, active: true },
      { id: 'windInfinity', label: 'Wind Infinity', price: '₹25,19,000*', order: 2, active: true },
      { id: 'sky', label: 'Sky', price: '₹26,19,000*', order: 3, active: true },
      { id: 'skyInfinity', label: 'Sky Infinity', price: '₹26,79,000*', order: 4, active: true },
    ],
  },
  {
    slug: 'mpv7',
    name: 'VF MPV 7',
    priceFrom: FALLBACK_MPV7_PRICE,
    range: '',
    active: true,
    variants: [{ id: 'base', label: 'Base', price: FALLBACK_MPV7_PRICE, order: 0, active: true }],
  },
  {
    slug: 'limo-green',
    name: 'Limo Green',
    priceFrom: '₹22.99 Lakh*',
    range: '',
    active: true,
    variants: [{ id: 'base', label: 'Base', price: '₹22.99 Lakh*', order: 0, active: true }],
  },
];

const SLUG_ORDER = VEHICLE_PRICING_DEFAULTS.map((d) => d.slug);

/**
 * @param {{ mpv7Price?: string } | null | undefined} siteConfig
 */
function buildDefaultPricingDocs(siteConfig) {
  const mpv7FromConfig = String(siteConfig?.mpv7Price || '').trim();
  const mpv7Price = mpv7FromConfig || FALLBACK_MPV7_PRICE;

  return VEHICLE_PRICING_DEFAULTS.map((doc) => {
    if (doc.slug !== 'mpv7') return { ...doc, variants: doc.variants.map((v) => ({ ...v })) };
    return {
      ...doc,
      priceFrom: mpv7Price,
      variants: doc.variants.map((v) => ({
        ...v,
        price: v.id === 'base' ? mpv7Price : v.price,
      })),
    };
  });
}

module.exports = {
  FALLBACK_MPV7_PRICE,
  VEHICLE_PRICING_DEFAULTS,
  SLUG_ORDER,
  buildDefaultPricingDocs,
};
