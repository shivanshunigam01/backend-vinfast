/**
 * schema.org JSON-LD builders. The frontend injects these objects into
 * <script type="application/ld+json"> tags so Google and AI answer engines
 * can understand the dealership, vehicles, FAQs and page hierarchy.
 */

const DEFAULT_SITE_URL = 'https://patliputravinfast.in';

function siteUrl() {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function absoluteUrl(path = '/') {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Parses "₹18.19L*" style price strings into a numeric rupee value, or null. */
function parsePriceToNumber(priceStr) {
  if (!priceStr) return null;
  const match = String(priceStr).match(/([\d.]+)\s*(l|lakh|cr|crore)?/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'l' || unit === 'lakh') return Math.round(value * 100000);
  if (unit === 'cr' || unit === 'crore') return Math.round(value * 10000000);
  return Math.round(value);
}

function organizationSchema(dealer = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl()}/#organization`,
    name: dealer.dealerName || 'Patliputra VinFast',
    url: siteUrl(),
    email: dealer.email || undefined,
    telephone: dealer.phone || undefined,
    brand: { '@type': 'Brand', name: dealer.brand || 'VinFast' },
    areaServed: { '@type': 'State', name: 'Bihar, India' },
  };
}

function autoDealerSchema(dealer = {}, districtName = null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutomotiveBusiness',
    '@id': `${siteUrl()}/#dealer`,
    name: dealer.dealerName || 'Patliputra VinFast',
    url: siteUrl(),
    telephone: dealer.phone || undefined,
    email: dealer.email || undefined,
    address: dealer.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: dealer.address,
          addressRegion: 'Bihar',
          addressCountry: 'IN',
        }
      : undefined,
    openingHours: dealer.showroomHours || undefined,
    brand: { '@type': 'Brand', name: dealer.brand || 'VinFast' },
    areaServed: {
      '@type': districtName ? 'City' : 'State',
      name: districtName ? `${districtName}, Bihar` : 'Bihar, India',
    },
  };
}

function websiteSchema(dealer = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl()}/#website`,
    name: dealer.dealerName || 'Patliputra VinFast',
    url: siteUrl(),
    publisher: { '@id': `${siteUrl()}/#organization` },
  };
}

/**
 * Vehicle schema for a model. `model` is a SEO_MODELS entry; `price` is the
 * display string from SiteConfig (e.g. "₹18.19L*").
 */
function vehicleSchema(model, { price, range, image, url } = {}) {
  const priceNumber = parsePriceToNumber(price);
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: model.name,
    brand: { '@type': 'Brand', name: 'VinFast' },
    model: model.shortName,
    bodyType: model.bodyType,
    seatingCapacity: model.seats,
    fuelType: 'Electric',
    vehicleEngine: { '@type': 'EngineSpecification', fuelType: 'Electric' },
    image: image || undefined,
    url: url || undefined,
    ...(range ? { mileageFromOdometer: { '@type': 'QuantitativeValue', name: `Certified range ${range}` } } : {}),
    ...(priceNumber
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: priceNumber,
            availability: 'https://schema.org/InStock',
            seller: { '@id': `${siteUrl()}/#dealer` },
          },
        }
      : {}),
  };
}

function faqSchema(faqs = []) {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** @param {Array<{name, path}>} crumbs - in order, starting from Home. */
function breadcrumbSchema(crumbs = []) {
  if (!crumbs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

module.exports = {
  siteUrl,
  absoluteUrl,
  parsePriceToNumber,
  organizationSchema,
  autoDealerSchema,
  websiteSchema,
  vehicleSchema,
  faqSchema,
  breadcrumbSchema,
};
