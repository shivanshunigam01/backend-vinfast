require('dotenv').config();
const connectDB = require('../config/db');
const { ensureDefaultPricing, listPricing } = require('../utils/vehiclePricingService');

(async () => {
  try {
    await connectDB();
    await ensureDefaultPricing();
    const docs = await listPricing({ activeOnly: false });
    console.log(
      `Vehicle pricing ready (${docs.length}):`,
      docs.map((d) => `${d.slug}=${d.priceFrom}`).join(', ')
    );
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed vehicle pricing:', error.message);
    process.exit(1);
  }
})();
