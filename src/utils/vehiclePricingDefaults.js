/**
 * Default vehicle pricing — synced with compareCatalog.ts / ModelVF6 variantExShowroomPrice.
 * VF6 Wind Infinity: ₹19,19,000* (compareCatalog id "infinity"; seed id windInfinity).
 */

const FALLBACK_MPV7_LIST = '₹24,49,000*';
const FALLBACK_MPV7_OFFER = '₹20,39,000*';
const FALLBACK_LIMO_LIST = '₹22,99,000*';
const FALLBACK_LIMO_OFFER = '₹18,59,000*';

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
    listPrice: FALLBACK_MPV7_LIST,
    priceFrom: FALLBACK_MPV7_OFFER,
    range: '517 km (ARAI)',
    active: true,
    variants: [{ id: 'base', label: 'Base', price: FALLBACK_MPV7_OFFER, order: 0, active: true }],
  },
  {
    slug: 'limo-green',
    name: 'Limo Green',
    listPrice: FALLBACK_LIMO_LIST,
    priceFrom: FALLBACK_LIMO_OFFER,
    range: '450 km',
    active: true,
    variants: [{ id: 'base', label: 'Base', price: FALLBACK_LIMO_OFFER, order: 0, active: true }],
  },
];

const SLUG_ORDER = VEHICLE_PRICING_DEFAULTS.map((d) => d.slug);

function compactPrice(s) {
  return String(s || '').replace(/\s/g, '').toLowerCase();
}

function pickFestiveOffer(slug, raw) {
  const p = compactPrice(raw);
  if (!p) return slug === 'mpv7' ? FALLBACK_MPV7_OFFER : FALLBACK_LIMO_OFFER;
  if (slug === 'mpv7') {
    if (/20[,.]?39/.test(p)) return String(raw).trim();
    return FALLBACK_MPV7_OFFER;
  }
  if (/18[,.]?59/.test(p)) return String(raw).trim();
  return FALLBACK_LIMO_OFFER;
}

function pickFestiveList(slug, raw) {
  const p = compactPrice(raw);
  if (!p) return slug === 'mpv7' ? FALLBACK_MPV7_LIST : FALLBACK_LIMO_LIST;
  if (slug === 'mpv7') {
    if (/24[,.]?49/.test(p)) return String(raw).trim();
    return FALLBACK_MPV7_LIST;
  }
  if (/22[,.]?99/.test(p)) return String(raw).trim();
  return FALLBACK_LIMO_LIST;
}

/**
 * @param {{ mpv7Price?: string, mpv7ListPrice?: string, limoGreenPrice?: string, limoGreenListPrice?: string } | null | undefined} siteConfig
 */
function buildDefaultPricingDocs(siteConfig) {
  const mpv7Offer = pickFestiveOffer('mpv7', siteConfig?.mpv7Price);
  const mpv7List = pickFestiveList('mpv7', siteConfig?.mpv7ListPrice);
  const limoOffer = pickFestiveOffer('limo-green', siteConfig?.limoGreenPrice);
  const limoList = pickFestiveList('limo-green', siteConfig?.limoGreenListPrice);

  return VEHICLE_PRICING_DEFAULTS.map((doc) => {
    const variants = doc.variants.map((v) => ({ ...v }));
    if (doc.slug === 'mpv7') {
      return {
        ...doc,
        listPrice: mpv7List,
        priceFrom: mpv7Offer,
        variants: variants.map((v) => (v.id === 'base' ? { ...v, price: mpv7Offer } : v)),
      };
    }
    if (doc.slug === 'limo-green') {
      return {
        ...doc,
        listPrice: limoList,
        priceFrom: limoOffer,
        variants: variants.map((v) => (v.id === 'base' ? { ...v, price: limoOffer } : v)),
      };
    }
    return { ...doc, variants };
  });
}

module.exports = {
  FALLBACK_MPV7_LIST,
  FALLBACK_MPV7_OFFER,
  FALLBACK_LIMO_LIST,
  FALLBACK_LIMO_OFFER,
  VEHICLE_PRICING_DEFAULTS,
  SLUG_ORDER,
  buildDefaultPricingDocs,
  pickFestiveOffer,
  pickFestiveList,
};
