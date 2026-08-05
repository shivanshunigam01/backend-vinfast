/**
 * Remove TD booking side-effects so legacy TestDrive sync cannot resurrect
 * deleted bookings (bootstrap / empty-list / customer login).
 */
const TDFeedback = require('../models/TDFeedback');
const TDLog = require('../models/TDLog');
const TestDrive = require('../models/TestDrive');
const Lead = require('../models/Lead');

function asId(ref) {
  if (!ref) return null;
  return ref._id || ref;
}

/**
 * @param {Array<object>|object} bookings — TDBooking docs (or lean objects) with _id / testDriveId
 */
async function cascadeDeleteBookingRelated(bookings) {
  const list = (Array.isArray(bookings) ? bookings : [bookings]).filter(Boolean);
  const bookingIds = list.map((b) => b._id).filter(Boolean);
  if (!bookingIds.length) {
    return { feedback: 0, logs: 0, testDrives: 0 };
  }

  const testDriveIds = [];
  for (const b of list) {
    const id = asId(b.testDriveId);
    if (id) testDriveIds.push(id);
  }

  const [feedbackResult, logResult, testDriveResult] = await Promise.all([
    TDFeedback.deleteMany({ bookingId: { $in: bookingIds } }),
    TDLog.deleteMany({ bookingId: { $in: bookingIds } }),
    testDriveIds.length
      ? TestDrive.deleteMany({ _id: { $in: testDriveIds } })
      : Promise.resolve({ deletedCount: 0 }),
  ]);

  await Lead.updateMany(
    { tdBookingId: { $in: bookingIds } },
    { $unset: { tdBookingId: '' } },
  );
  if (testDriveIds.length) {
    await Lead.updateMany(
      { testDriveId: { $in: testDriveIds } },
      { $unset: { testDriveId: '' } },
    );
  }

  return {
    feedback: feedbackResult.deletedCount || 0,
    logs: logResult.deletedCount || 0,
    testDrives: testDriveResult.deletedCount || 0,
  };
}

module.exports = { cascadeDeleteBookingRelated };
