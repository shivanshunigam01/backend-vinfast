const { MODEL_PAGE_SLUGS } = require('../models/ModelPageContent');

const MODEL_HOME_DEFAULTS = {
  vf6: {
    title: 'VinFast VF 6',
    subtitle: 'Built for a brighter tomorrow. Smart electric SUV — exclusively at Patliputra VinFast, Bihar.',
    badge: 'Explore VF 6',
    ctaPrimary: 'Explore VF 6',
    ctaPrimaryLink: '/models/vf6',
    ctaSecondary: 'Book Test Drive',
    ctaSecondaryLink: '/test-drive',
    order: 20,
    objectPosition: 'center center',
  },
  vf7: {
    title: 'VinFast VF 7',
    subtitle: 'Born Sporty. Effortlessly Sophisticated. Bihar\'s favourite electric SUV.',
    badge: 'Now Available',
    ctaPrimary: 'Explore VF 7',
    ctaPrimaryLink: '/models/vf7',
    ctaSecondary: 'Book Test Drive',
    ctaSecondaryLink: '/test-drive',
    order: 21,
    objectPosition: 'center center',
  },
  mpv7: {
    title: 'VF MPV 7',
    subtitle: 'Your World. On The Move. Seven-seat electric MPV from VinFast.',
    badge: 'New launch',
    ctaPrimary: 'Explore VF MPV 7',
    ctaPrimaryLink: '/models/mpv7',
    ctaSecondary: 'Book Test Drive',
    ctaSecondaryLink: '/test-drive',
    order: 22,
    objectPosition: 'center center',
  },
  'limo-green': {
    title: 'VinFast Limo Green',
    subtitle: 'Built for your business. Seven-seat electric MPV for families and fleets.',
    badge: 'Explore Limo Green',
    ctaPrimary: 'Explore Limo Green',
    ctaPrimaryLink: '/models/limo-green',
    ctaSecondary: 'Book Test Drive',
    ctaSecondaryLink: '/test-drive',
    order: 23,
    objectPosition: 'center center',
  },
};

function normalizeHeroFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const imageUrl = String(raw.imageUrl || '').trim();
  if (!imageUrl) return null;
  return {
    imageUrl,
    width: Number.isFinite(Number(raw.width)) && Number(raw.width) > 0 ? Number(raw.width) : 3840,
    height: Number.isFinite(Number(raw.height)) && Number(raw.height) > 0 ? Number(raw.height) : 2160,
    alt: String(raw.alt || '').trim(),
    imageFit: raw.imageFit === 'contain' ? 'contain' : 'cover',
    showcaseOnHomepage: raw.showcaseOnHomepage === true,
    homepageHeroOrder: Number.isFinite(Number(raw.homepageHeroOrder)) ? Number(raw.homepageHeroOrder) : 10,
    homepageHeroTitle: String(raw.homepageHeroTitle || '').trim(),
    homepageHeroSubtitle: String(raw.homepageHeroSubtitle || '').trim(),
    homepageHeroBadge: String(raw.homepageHeroBadge || '').trim(),
    homepageObjectPosition: String(raw.homepageObjectPosition || 'center center').trim(),
  };
}

function modelPageDocToHomeHeroSlide(doc) {
  const slug = String(doc?.slug || '').toLowerCase();
  if (!MODEL_PAGE_SLUGS.includes(slug)) return null;
  const hero = normalizeHeroFields(doc.hero);
  if (!hero?.showcaseOnHomepage || !hero.imageUrl) return null;

  const defaults = MODEL_HOME_DEFAULTS[slug] || MODEL_HOME_DEFAULTS.vf6;

  return {
    title: hero.homepageHeroTitle || defaults.title,
    subtitle: hero.homepageHeroSubtitle || defaults.subtitle,
    badge: hero.homepageHeroBadge || defaults.badge,
    ctaPrimary: defaults.ctaPrimary,
    ctaPrimaryLink: defaults.ctaPrimaryLink,
    ctaSecondary: defaults.ctaSecondary,
    ctaSecondaryLink: defaults.ctaSecondaryLink,
    bgImage: hero.imageUrl,
    objectPosition: hero.homepageObjectPosition || defaults.objectPosition,
    active: true,
    order: hero.homepageHeroOrder ?? defaults.order,
    source: 'model-page',
    modelSlug: slug,
  };
}

module.exports = {
  MODEL_HOME_DEFAULTS,
  normalizeHeroFields,
  modelPageDocToHomeHeroSlide,
};
