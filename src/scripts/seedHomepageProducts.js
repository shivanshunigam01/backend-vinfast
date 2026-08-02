/**
 * Upsert Product docs used by homepage Model Discovery (heroImage left empty =
 * bundled assets remain the fallback until admin uploads).
 *
 * Usage: node src/scripts/seedHomepageProducts.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
const Product = require('../models/Product');
const SiteConfig = require('../models/SiteConfig');

const DEFAULT_PRICES = {
  vf6: '₹18.19L*',
  vf7: '₹22.99L*',
  mpv7: '₹24.49L*',
  'limo-green': '₹22.99L*',
};

const HOMEPAGE_PRODUCTS = [
  {
    slug: 'vf7',
    name: 'VF 7',
    tagline: 'Bold. Intelligent. Unstoppable.',
    sitePriceKey: 'vf7Price',
    order: 0,
  },
  {
    slug: 'vf6',
    name: 'VF 6',
    tagline: 'Compact. Smart. Electrifying.',
    sitePriceKey: 'vf6Price',
    order: 1,
  },
  {
    slug: 'mpv7',
    name: 'VF MPV 7',
    tagline: 'Space. Seven seats. Electric.',
    sitePriceKey: 'mpv7Price',
    order: 2,
  },
  {
    slug: 'limo-green',
    name: 'Limo Green',
    tagline: 'Built for your business.',
    sitePriceKey: 'limoGreenPrice',
    order: 3,
  },
];

(async () => {
  try {
    await connectDB();
    const site = (await SiteConfig.findOne().lean()) || {};

    const results = [];
    for (const row of HOMEPAGE_PRODUCTS) {
      const priceFrom =
        String(site[row.sitePriceKey] || '').trim() || DEFAULT_PRICES[row.slug];

      const doc = await Product.findOneAndUpdate(
        { slug: row.slug },
        {
          $set: {
            name: row.name,
            tagline: row.tagline,
            priceFrom,
            order: row.order,
            active: true,
          },
          $setOnInsert: {
            slug: row.slug,
            heroImage: '',
            galleryImages: [],
            colorVariants: [],
          },
        },
        { upsert: true, new: true }
      );

      results.push(
        `${doc.slug}: ${doc.name} @ ${doc.priceFrom}` +
          (doc.heroImage ? ' (has heroImage)' : ' (heroImage empty)')
      );
    }

    console.log(`Homepage products ready (${results.length}):`);
    results.forEach((line) => console.log(`  - ${line}`));
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed homepage products:', error.message);
    process.exit(1);
  }
})();
