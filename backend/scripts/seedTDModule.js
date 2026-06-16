/**
 * Test Drive Module — Demo fleet + slot configuration seed
 * Seeds: Branch (if missing), Demo Vehicles (website trims), Slot Config
 *
 * Run: node scripts/seedTDModule.js
 * Force replace fleet: node scripts/seedTDModule.js --force-fleet
 */
require('dotenv').config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const DemoVehicle = require('../models/DemoVehicle');
const TDSlotConfig = require('../models/TDSlotConfig');
const ChargingLog = require('../models/ChargingLog');
const Admin = require('../models/Admin');
const { buildDemoFleet, SLOT_CONFIG_DEFAULTS } = require('../data/tdDemoFleet');

const FORCE_FLEET = process.argv.includes('--force-fleet');
const FORCE_SCHEDULE = process.argv.includes('--force-schedule');

async function seed() {
  try {
    await connectDB();
    console.log('🚀 TD Module — demo fleet & slot config seed\n');

    let branch = await Branch.findOne({ code: 'PAT' });
    if (!branch) {
      branch = await Branch.create({
        name: 'Patna Showroom',
        code: 'PAT',
        address: 'Bailey Road, Patna, Bihar',
        city: 'Patna',
        phone: '0612-2345678',
        active: true
      });
      console.log(`📍 Created branch: ${branch.name}`);
    } else {
      console.log(`📍 Branch: ${branch.name} (${branch.code})`);
    }

    if (FORCE_FLEET) {
      await ChargingLog.deleteMany({});
      await DemoVehicle.deleteMany({});
      console.log('🗑️  Cleared existing demo fleet\n');
    }

    const vehiclesData = buildDemoFleet(branch._id);
    const vehicles = [];

    for (const vd of vehiclesData) {
      let v = await DemoVehicle.findOne({ registrationNo: vd.registrationNo });
      if (!v) {
        v = await DemoVehicle.create(vd);
      } else {
        Object.assign(v, vd);
        await v.save();
      }
      vehicles.push(v);
    }

    const chargingVeh = vehicles.find((v) => v.status === 'CHARGING');
    if (chargingVeh) {
      await ChargingLog.deleteMany({ vehicleId: chargingVeh._id, status: 'CHARGING' });
      const manager = await Admin.findOne({ role: 'manager' });
      await ChargingLog.create({
        vehicleId: chargingVeh._id,
        startTime: new Date(Date.now() - 30 * 60 * 1000),
        startBattery: 12,
        targetBattery: 100,
        expectedCompletionTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        chargingPoint: 'Station A',
        status: 'CHARGING',
        loggedBy: manager?._id
      });
    }

    console.log(`\n🚗 Demo fleet: ${vehicles.length} vehicles`);
    vehicles.forEach((v) => {
      console.log(`   ${v.vehicleId} — ${v.model} ${v.variant} · ${v.color} · ${v.status} · ${v.batteryPercent}%`);
    });

    const slotConfig = await TDSlotConfig.findOne({ branchId: branch._id });
    if (!slotConfig) {
      await TDSlotConfig.create({ branchId: branch._id, ...SLOT_CONFIG_DEFAULTS });
    } else {
      Object.assign(slotConfig, SLOT_CONFIG_DEFAULTS);
      if (FORCE_SCHEDULE || !slotConfig.slotTimes?.length) {
        slotConfig.slotTimes = SLOT_CONFIG_DEFAULTS.slotTimes;
      }
      await slotConfig.save();
    }
    const savedSlotConfig = await TDSlotConfig.findOne({ branchId: branch._id });

    console.log('\n⏰ Slot configuration');
    console.log(`   ${savedSlotConfig.workingStartTime}–${savedSlotConfig.workingEndTime}`);
    console.log(`   ${savedSlotConfig.slotDuration} min slots + ${savedSlotConfig.bufferTime} min buffer`);
    console.log(`   Max ${savedSlotConfig.maxConcurrentBookings} concurrent booking(s) per slot`);

    console.log('\n✅ TD demo fleet & slot config ready.');
    console.log('   Admin → TD Vehicles / TD Config should now show data.\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
