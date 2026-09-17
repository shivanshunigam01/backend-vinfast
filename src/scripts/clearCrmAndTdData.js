/**
 * Delete all CRM leads, test-drive bookings, and interconnected transactional data.
 * Reports are computed live — clearing source collections empties all lead/TD reports.
 *
 * Keeps: TDStaff, StaffRole, branches, slot config, demo fleet rows, lead stage master, admins.
 *
 * Usage:
 *   CLEAR_CRM_TD_CONFIRM=yes node src/scripts/clearCrmAndTdData.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');

const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadStageHistory = require('../models/LeadStageHistory');
const LeadFavourite = require('../models/LeadFavourite');
const MetaLead = require('../models/MetaLead');
const Enquiry = require('../models/Enquiry');
const PVCustomer = require('../models/PVCustomer');
const TDBooking = require('../models/TDBooking');
const TDFeedback = require('../models/TDFeedback');
const TDLog = require('../models/TDLog');
const TDRescheduleRequest = require('../models/TDRescheduleRequest');
const TDNotification = require('../models/TDNotification');
const TestDrive = require('../models/TestDrive');
const TestDriveFeedback = require('../models/TestDriveFeedback');
const TDCustomer = require('../models/TDCustomer');
const StaffNotification = require('../models/StaffNotification');
const CustomerComplaint = require('../models/CustomerComplaint');
const VehicleOrder = require('../models/VehicleOrder');
const VehicleAllocation = require('../models/VehicleAllocation');
const VehicleStock = require('../models/VehicleStock');
const TDBookingDeleteAudit = require('../models/TDBookingDeleteAudit');
const WhatsappOtpChallenge = require('../models/WhatsappOtpChallenge');
const Counter = require('../models/Counter');
const TDVehicle = require('../models/TDVehicle');
const { cascadeDeleteBookingRelated } = require('../utils/tdBookingCascadeDelete');

async function countAll(models) {
  const entries = await Promise.all(
    Object.entries(models).map(async ([name, Model]) => {
      const count = await Model.countDocuments();
      return [name, count];
    }),
  );
  return Object.fromEntries(entries);
}

async function deleteAll(Model, label) {
  const before = await Model.countDocuments();
  const result = await Model.deleteMany({});
  console.log(`  ${label}: deleted ${result.deletedCount} (was ${before})`);
  return result.deletedCount ?? 0;
}

(async () => {
  try {
    if (process.env.CLEAR_CRM_TD_CONFIRM !== 'yes') {
      console.error(
        'Refusing to run: set CLEAR_CRM_TD_CONFIRM=yes in environment to wipe CRM + TD data.',
      );
      process.exit(1);
    }

    await connectDB();

    console.log('\n=== Before ===');
    const before = await countAll({
      leads: Lead,
      leadFollowUps: LeadFollowUp,
      leadStageHistories: LeadStageHistory,
      leadFavourites: LeadFavourite,
      metaLeads: MetaLead,
      enquiries: Enquiry,
      pvCustomers: PVCustomer,
      tdBookings: TDBooking,
      tdFeedbacks: TDFeedback,
      tdLogs: TDLog,
      tdRescheduleRequests: TDRescheduleRequest,
      tdNotifications: TDNotification,
      testDrives: TestDrive,
      testDriveFeedbacks: TestDriveFeedback,
      tdCustomers: TDCustomer,
      staffNotifications: StaffNotification,
      customerComplaints: CustomerComplaint,
      vehicleOrders: VehicleOrder,
      vehicleAllocations: VehicleAllocation,
    });
    console.table(before);

    console.log('\n=== Deleting CRM + TD transactional data ===');

    // Child records first
    await deleteAll(LeadFollowUp, 'Lead follow-ups');
    await deleteAll(LeadStageHistory, 'Lead stage history');
    await deleteAll(LeadFavourite, 'Lead favourites');
    await deleteAll(StaffNotification, 'Staff notifications');
    await deleteAll(TDNotification, 'TD notifications');
    await deleteAll(TDRescheduleRequest, 'TD reschedule requests');
    await deleteAll(TDFeedback, 'TD feedback');
    await deleteAll(TDLog, 'TD logs');

    const bookings = await TDBooking.find({}).lean();
    if (bookings.length) {
      await cascadeDeleteBookingRelated(bookings);
    }
    await deleteAll(TDBooking, 'TD bookings');
    await deleteAll(TestDrive, 'Test drives');
    await deleteAll(TestDriveFeedback, 'Test drive feedback (public)');

    await deleteAll(MetaLead, 'Meta leads');
    await deleteAll(VehicleOrder, 'Vehicle orders (booking reports)');
    await deleteAll(VehicleAllocation, 'Vehicle allocations (lead-linked)');
    await deleteAll(CustomerComplaint, 'Customer complaints');
    await deleteAll(Lead, 'CRM leads');
    await deleteAll(Enquiry, 'Website enquiries');
    await deleteAll(TDCustomer, 'TD customers');
    await deleteAll(PVCustomer, 'PV customers (lead intake)');
    await deleteAll(TDBookingDeleteAudit, 'TD booking delete audit');
    await deleteAll(WhatsappOtpChallenge, 'WhatsApp OTP challenges');

    // Clear lead refs on stock rows (keep inventory)
    const stockUnset = await VehicleStock.updateMany(
      { leadId: { $exists: true, $ne: null } },
      { $unset: { leadId: 1 } },
    );
    console.log(`  Vehicle stock lead refs unset: ${stockUnset.modifiedCount ?? 0}`);

    // Reset demo fleet TD counters
    const fleetReset = await TDVehicle.updateMany(
      {},
      { $set: { totalTestDriveKM: 0, totalTestDrives: 0 } },
    );
    console.log(`  TD vehicle stats reset: ${fleetReset.modifiedCount ?? 0} vehicle(s)`);

    // Restart PV ID sequences
    const counterKeys = ['pv_lead', 'pv_opportunity', 'pv_customer'];
    for (const key of counterKeys) {
      await Counter.findOneAndUpdate({ key }, { seq: 0 }, { upsert: true });
    }
    console.log(`  Counters reset: ${counterKeys.join(', ')}`);

    console.log('\n=== After ===');
    const after = await countAll({
      leads: Lead,
      leadFollowUps: LeadFollowUp,
      tdBookings: TDBooking,
      testDrives: TestDrive,
      vehicleOrders: VehicleOrder,
      pvCustomers: PVCustomer,
    });
    console.table(after);

    console.log('\nDone. Staff, roles, branches, slots, and fleet master data were kept.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear CRM + TD data:', error);
    process.exit(1);
  }
})();
