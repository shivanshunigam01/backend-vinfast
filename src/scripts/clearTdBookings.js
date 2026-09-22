/**
 * Delete all test-drive data, linked report inputs, and TD fields on CRM leads.
 * Keeps: CRM leads, staff/users, branches, slots, demo fleet rows (stats reset).
 *
 * Usage:
 *   CLEAR_TD_BOOKINGS_CONFIRM=yes node src/scripts/clearTdBookings.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const TDFeedback = require('../models/TDFeedback');
const TestDrive = require('../models/TestDrive');
const TestDriveFeedback = require('../models/TestDriveFeedback');
const TDLog = require('../models/TDLog');
const TDCustomer = require('../models/TDCustomer');
const TDRescheduleRequest = require('../models/TDRescheduleRequest');
const TDNotification = require('../models/TDNotification');
const TDBookingDeleteAudit = require('../models/TDBookingDeleteAudit');
const TDVehicle = require('../models/TDVehicle');
const { cascadeDeleteBookingRelated } = require('../utils/tdBookingCascadeDelete');

(async () => {
  try {
    if (process.env.CLEAR_TD_BOOKINGS_CONFIRM !== 'yes') {
      console.error(
        'Refusing to run: set CLEAR_TD_BOOKINGS_CONFIRM=yes in environment to delete all TD data.',
      );
      process.exit(1);
    }

    await connectDB();

    const before = {
      tdBookings: await TDBooking.countDocuments(),
      tdFeedbacks: await TDFeedback.countDocuments(),
      tdLogs: await TDLog.countDocuments(),
      testDrives: await TestDrive.countDocuments(),
      testDriveFeedbacks: await TestDriveFeedback.countDocuments(),
      tdCustomers: await TDCustomer.countDocuments(),
      tdReschedules: await TDRescheduleRequest.countDocuments(),
      tdNotifications: await TDNotification.countDocuments(),
      tdDeleteAudit: await TDBookingDeleteAudit.countDocuments(),
      leadsWithTdBooking: await Lead.countDocuments({ tdBookingId: { $exists: true, $ne: null } }),
      leadsWithCreTd: await Lead.countDocuments({
        $or: [
          { 'creSheet.tdDate': { $exists: true, $ne: null } },
          { 'creSheet.tdDone': true },
        ],
      }),
    };
    console.log('\n=== Before ===');
    console.table(before);

    const bookings = await TDBooking.find({}).lean();
    if (bookings.length) {
      await cascadeDeleteBookingRelated(bookings);
    }

    const [
      bookingResult,
      feedbackResult,
      logResult,
      testDriveResult,
      publicFeedbackResult,
      customerResult,
      rescheduleResult,
      notificationResult,
      auditResult,
    ] = await Promise.all([
      TDBooking.deleteMany({}),
      TDFeedback.deleteMany({}),
      TDLog.deleteMany({}),
      TestDrive.deleteMany({}),
      TestDriveFeedback.deleteMany({}),
      TDCustomer.deleteMany({}),
      TDRescheduleRequest.deleteMany({}),
      TDNotification.deleteMany({}),
      TDBookingDeleteAudit.deleteMany({}),
    ]);

    const leadTdUnset = await Lead.updateMany(
      {},
      {
        $unset: {
          tdBookingId: '',
          testDriveId: '',
        },
        $set: {
          'creSheet.tdDate': null,
          'creSheet.tdDone': false,
          'creSheet.tdNotDoneWhy': '',
          'creSheet.afterTdRemark': '',
        },
      },
    );

    const fleetReset = await TDVehicle.updateMany(
      {},
      { $set: { totalTestDriveKM: 0, totalTestDrives: 0 } },
    );

    const after = {
      tdBookings: await TDBooking.countDocuments(),
      testDrives: await TestDrive.countDocuments(),
      tdCustomers: await TDCustomer.countDocuments(),
      leadsWithTdBooking: await Lead.countDocuments({ tdBookingId: { $exists: true, $ne: null } }),
      leadsWithCreTd: await Lead.countDocuments({
        $or: [
          { 'creSheet.tdDate': { $exists: true, $ne: null } },
          { 'creSheet.tdDone': true },
        ],
      }),
    };

    console.log('\n=== Deleted ===');
    console.log(`  TD bookings: ${bookingResult.deletedCount}`);
    console.log(`  TD feedback: ${feedbackResult.deletedCount}`);
    console.log(`  TD logs: ${logResult.deletedCount}`);
    console.log(`  Legacy TestDrive: ${testDriveResult.deletedCount}`);
    console.log(`  Public test-drive feedback: ${publicFeedbackResult.deletedCount}`);
    console.log(`  TD customers: ${customerResult.deletedCount}`);
    console.log(`  TD reschedule requests: ${rescheduleResult.deletedCount}`);
    console.log(`  TD notifications: ${notificationResult.deletedCount}`);
    console.log(`  TD delete audit: ${auditResult.deletedCount}`);
    console.log(`  CRM leads TD fields cleared: ${leadTdUnset.modifiedCount ?? 0}`);
    console.log(`  Demo fleet TD stats reset: ${fleetReset.modifiedCount ?? 0} vehicle(s)`);

    console.log('\n=== After ===');
    console.table(after);
    console.log('\nDone. CRM leads and staff/users were kept — ready for fresh TD sheet import.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear TD data:', error.message);
    process.exit(1);
  }
})();
