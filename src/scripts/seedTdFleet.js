/**
 * Add missing demo fleet vehicles (safe upsert — skips existing plates/IDs).
 *
 * Usage on server:
 *   SEED_TD_FLEET_CONFIRM=yes npm run seed:td-fleet
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const TDVehicle = require('../models/TDVehicle');
const { ensureTdBranch, ensureTdFleet, FLEET_SEED } = require('../utils/tdBootstrap');

(async () => {
  try {
    if (process.env.SEED_TD_FLEET_CONFIRM !== 'yes') {
      console.error('Set SEED_TD_FLEET_CONFIRM=yes to add demo fleet vehicles.');
      process.exit(1);
    }

    await connectDB();
    const branch = await ensureTdBranch();
    const before = await TDVehicle.countDocuments();
    const created = await ensureTdFleet(branch._id);
    const after = await TDVehicle.countDocuments();

    console.log('\n=== Demo fleet seed ===');
    console.log(`Branch:   ${branch.name} (${branch.code})`);
    console.log(`Before:   ${before} vehicle(s)`);
    console.log(`Added:    ${created} new vehicle(s)`);
    console.log(`Total:    ${after} vehicle(s)`);
    console.log(`Seed set: ${FLEET_SEED.length} configured demo cars`);
    console.log('\nAll new cars are status AVAILABLE and linked to Patna branch.');
    process.exit(0);
  } catch (error) {
    console.error('Fleet seed failed:', error.message);
    process.exit(1);
  }
})();
