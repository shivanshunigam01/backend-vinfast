/**
 * Full TD module seed — branches, slots, fleet, staff, sync bookings.
 *
 * Usage on server:
 *   SEED_TD_MODULE_CONFIRM=yes npm run seed:td-module
 */
require('dotenv').config();
const connectDB = require('../config/db');
const {
  ensureTdModuleReady,
  STAFF_SEED,
  FLEET_SEED,
} = require('../utils/tdBootstrap');
const TDBranch = require('../models/TDBranch');
const TDSlotConfig = require('../models/TDSlotConfig');
const TDVehicle = require('../models/TDVehicle');
const TDStaff = require('../models/TDStaff');
const TDBooking = require('../models/TDBooking');

(async () => {
  try {
    if (process.env.SEED_TD_MODULE_CONFIRM !== 'yes') {
      console.error('Set SEED_TD_MODULE_CONFIRM=yes to seed the full TD module.');
      process.exit(1);
    }

    process.env.TD_DEMO_SEED = 'true';
    process.env.TD_SYNC_LEGACY = process.env.TD_SYNC_LEGACY || 'true';
    await connectDB();
    const results = await ensureTdModuleReady();

    const [branches, slots, vehicles, staff, bookings] = await Promise.all([
      TDBranch.countDocuments(),
      TDSlotConfig.countDocuments(),
      TDVehicle.countDocuments(),
      TDStaff.countDocuments(),
      TDBooking.countDocuments(),
    ]);

    console.log('\n=== TD Module ready ===');
    console.log(`Branches:  ${branches}`);
    console.log(`Slot cfg:  ${slots}`);
    console.log(`Fleet:     ${vehicles} (${FLEET_SEED.length} demo cars if freshly seeded)`);
    console.log(`Staff:     ${staff} (${STAFF_SEED.length} hierarchy users if freshly seeded)`);
    console.log(`Bookings:  ${bookings}`);
    console.log('\nBootstrap:', results);
    console.log('\nStaff default password:', process.env.SEED_TD_STAFF_PASSWORD || 'ChangeMe123!');
    console.log('Login: /admin/login with any staff email above.');
    process.exit(0);
  } catch (error) {
    console.error('TD module seed failed:', error.message);
    process.exit(1);
  }
})();
