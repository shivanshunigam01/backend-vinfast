require('dotenv').config();
const connectDB = require('../config/db');
const { ensureDefaultLeadStages, listLeadStages } = require('../utils/leadStageService');

(async () => {
  try {
    await connectDB();
    await ensureDefaultLeadStages();
    const docs = await listLeadStages({ includeInactive: true });
    console.log(`Lead stages ready (${docs.length}):`, docs.map((d) => d.label).join(', '));
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed lead stages:', error.message);
    process.exit(1);
  }
})();
