/**
 * schema.org JSON-LD builders for Organisation, the real Patna AutoDealer,
 * Product/Offer, Article and breadcrumbs. Do not emit a fake district showroom.
 */

const { PATNA_SHOWROOM, resolveDealerLocation, formatShowroomAddress } = require('../constants/seoLocation');

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
  const loc = resolveDealerLocation(dealer);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl()}/#organization`,
    name: loc.name,
    url: siteUrl(),
    email: loc.email || undefined,
    telephone: loc.telephone || undefined,
    logo: absoluteUrl('/favicon.png'),
    brand: { '@type': 'Brand', name: loc.brand },
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.streetAddress,
      addressLocality: loc.addressLocality,
      addressRegion: loc.addressRegion,
      postalCode: loc.postalCode,
      addressCountry: loc.addressCountry,
    },
    areaServed: { '@type': 'State', name: 'Bihar, India' },
  };
}

/** Real Patna showroom only — never a cloned district branch. */
function autoDealerSchema(dealer = {}) {
  const loc = resolveDealerLocation(dealer);
  return {
    '@context': 'https://schema.org',
    '@type': ['AutomotiveBusiness', 'AutoDealer'],
    '@id': `${siteUrl()}/#dealer`,
    name: loc.name,
    url: siteUrl(),
    telephone: loc.telephone || undefined,
    email: loc.email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.streetAddress,
      addressLocality: loc.addressLocality,
      addressRegion: loc.addressRegion,
      postalCode: loc.postalCode,
      addressCountry: loc.addressCountry,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: loc.openingDays,
      opens: loc.opens,
      closes: loc.closes,
    },
    brand: { '@type': 'Brand', name: loc.brand },
    areaServed: { '@type': 'State', name: 'Bihar, India' },
  };
}

function websiteSchema(dealer = {}) {
  const loc = resolveDealerLocation(dealer);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl()}/#website`,
    name: loc.name,
    url: siteUrl(),
    publisher: { '@id': `${siteUrl()}/#organization` },
  };
}

function productSchema(model, { price, range, image, url } = {}) {
  const priceNumber = parsePriceToNumber(price);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: model.name,
    brand: { '@type': 'Brand', name: 'VinFast' },
    category: model.bodyType,
    description: `${model.name} — ${model.seats}-seater ${String(model.bodyType || '').toLowerCase()} sold in Bihar by Patliputra VinFast, Patna.`,
    image: image || undefined,
    url: url || undefined,
    ...(range ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'Certified range', value: range }] } : {}),
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

function articleSchema({ headline, description, url, datePublished, dateModified, image, authorName }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url: url ? absoluteUrl(url) : undefined,
    datePublished: datePublished || undefined,
    dateModified: dateModified || datePublished || undefined,
    image: image || undefined,
    author: { '@type': 'Organization', name: authorName || 'Patliputra VinFast' },
    publisher: { '@id': `${siteUrl()}/#organization` },
    mainEntityOfPage: url ? absoluteUrl(url) : undefined,
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
  productSchema,
  articleSchema,
  breadcrumbSchema,
  PATNA_SHOWROOM,
  formatShowroomAddress,
  resolveDealerLocation,
};
