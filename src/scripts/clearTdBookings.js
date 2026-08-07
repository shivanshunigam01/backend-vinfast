/**
 * Delete all TD bookings and related feedback records.
 *
 * Usage (on server):
 *   node src/scripts/clearTdBookings.js
 *
 * Optional: set CLEAR_TD_BOOKINGS_CONFIRM=yes in .env or env to skip prompt guard.
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const TDBooking = require('../models/TDBooking');
const TDFeedback = require('../models/TDFeedback');
const TestDrive = require('../models/TestDrive');
const TDLog = require('../models/TDLog');
const { cascadeDeleteBookingRelated } = require('../utils/tdBookingCascadeDelete');
const { recordBookingDeletes } = require('../utils/tdBookingDeleteAudit');

(async () => {
  try {
    if (process.env.CLEAR_TD_BOOKINGS_CONFIRM !== 'yes') {
      console.error(
        'Refusing to run: set CLEAR_TD_BOOKINGS_CONFIRM=yes in environment to delete all TD bookings.',
      );
      process.exit(1);
    }

    await connectDB();

    const bookings = await TDBooking.find({}).lean();
    const [bookingCount, feedbackCount, logCount, testDriveCount] = await Promise.all([
      TDBooking.countDocuments(),
      TDFeedback.countDocuments(),
      TDLog.countDocuments(),
      TestDrive.countDocuments(),
    ]);

    if (bookings.length) {
      await recordBookingDeletes({
        mode: 'script',
        bookings,
        admin: null,
        note: 'clearTdBookings.js (CLEAR_TD_BOOKINGS_CONFIRM=yes)',
      });
      await cascadeDeleteBookingRelated(bookings);
    }

    const [bookingResult, feedbackResult, logResult, testDriveResult] = await Promise.all([
      TDBooking.deleteMany({}),
      TDFeedback.deleteMany({}),
      TDLog.deleteMany({}),
      TestDrive.deleteMany({}),
    ]);

    console.log(`Deleted ${bookingResult.deletedCount} TD booking(s) (had ${bookingCount}).`);
    console.log(`Deleted ${feedbackResult.deletedCount} feedback (had ${feedbackCount}).`);
    console.log(`Deleted ${logResult.deletedCount} TD log(s) (had ${logCount}).`);
    console.log(`Deleted ${testDriveResult.deletedCount} TestDrive(s) (had ${testDriveCount}).`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear TD bookings:', error.message);
    process.exit(1);
  }
})();
