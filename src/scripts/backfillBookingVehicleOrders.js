/**
 * Backfill VehicleOrders for leads already in Booking without an open order.
 *
 *   node src/scripts/backfillBookingVehicleOrders.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
const { backfillBookingVehicleOrders } = require('../utils/ensureVehicleOrder');

(async () => {
  try {
    await connectDB();
    const summary = await backfillBookingVehicleOrders(null);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
