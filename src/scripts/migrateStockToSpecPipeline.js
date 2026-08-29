/**
 * One-time migration: map legacy VehicleStock records to spec pipeline statuses.
 * Run: node src/scripts/migrateStockToSpecPipeline.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const VehicleStock = require('../models/VehicleStock');
const StockPdi = require('../models/StockPdi');
const { mapLegacyToVehicleStatus, computeAgeingBucket, computeStockAgeDays } = require('../services/vehicleLifecycleService');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const stocks = await VehicleStock.find({});
  let updated = 0;

  for (const stock of stocks) {
    if (stock.vehicleStatus && stock.vehicleStatus !== 'IN_TRANSIT') continue;

    const legacyStatus = stock.status;
    const pdiStatus = stock.pdiStatus;
    let vehicleStatus = mapLegacyToVehicleStatus(legacyStatus, pdiStatus);

    if (legacyStatus === 'FRESH_STOCK' || pdiStatus === 'YARD_PASSED') {
      vehicleStatus = 'AVAILABLE';
      stock.grnDate = stock.grnDate || stock.updatedAt;
    }
    if (legacyStatus === 'SOLD') vehicleStatus = 'DELIVERED';
    if (legacyStatus === 'RESERVED') vehicleStatus = 'RESERVED';

    stock.vehicleStatus = vehicleStatus;
    if (stock.grnDate) {
      stock.stockAgeDays = computeStockAgeDays(stock.grnDate);
      stock.ageingBucket = computeAgeingBucket(stock.grnDate);
    }
    if (stock.batteryPercent && !stock.lastSoc) stock.lastSoc = stock.batteryPercent;
    await stock.save();
    updated += 1;
  }

  const pos = await mongoose.connection.db.collection('purchaseorders').find({ status: { $in: ['RAISED', 'PARTIAL'] } }).toArray();
  for (const po of pos) {
    const newStatus = po.status === 'RAISED' ? 'RELEASED' : 'PART_SUPPLIED';
    await mongoose.connection.db.collection('purchaseorders').updateOne({ _id: po._id }, { $set: { status: newStatus } });
  }

  console.log(`Migration complete — updated ${updated} vehicle stock records, ${pos.length} PO status mappings`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
