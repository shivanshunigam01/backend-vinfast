const TDBookingDeleteAudit = require('../models/TDBookingDeleteAudit');

function asId(ref) {
  if (!ref) return null;
  return ref._id || ref;
}

function snapshotBooking(doc) {
  if (!doc) return null;
  return {
    bookingObjectId: doc._id,
    bookingCode: doc.bookingId || undefined,
    bookingStatus: doc.bookingStatus || undefined,
    customerName: doc.customerName || undefined,
    customerMobile: doc.customerMobile || undefined,
    slotDate: doc.slotDate || undefined,
    slotTime: doc.slotTime || undefined,
    preferredModel: doc.preferredModel || undefined,
    testDriveId: asId(doc.testDriveId) || undefined,
    assignedExecutive: asId(doc.assignedExecutive) || undefined,
  };
}

function actorFromAdmin(admin) {
  if (!admin) {
    return {
      deletedById: undefined,
      deletedByName: 'System',
      deletedByEmail: undefined,
      deletedByRole: undefined,
      deletedByDesignation: undefined,
      deletedByUserType: 'system',
    };
  }
  return {
    deletedById: admin._id,
    deletedByName: admin.name || admin.email || 'Unknown',
    deletedByEmail: admin.email ? String(admin.email).toLowerCase() : undefined,
    deletedByRole: admin.role || undefined,
    deletedByDesignation: admin.designation || undefined,
    deletedByUserType: admin.userType || 'admin',
  };
}

/**
 * Persist a delete audit row. Never throws into the request path — logs and returns null on failure.
 */
async function recordBookingDeletes({
  mode,
  bookings = [],
  admin = null,
  requestedCount,
  skippedInProgress = [],
  note,
}) {
  const list = (Array.isArray(bookings) ? bookings : [bookings]).filter(Boolean);
  const snapshots = list.map(snapshotBooking).filter(Boolean);

  try {
    return await TDBookingDeleteAudit.create({
      mode,
      deletedCount: snapshots.length,
      requestedCount: requestedCount != null ? requestedCount : snapshots.length,
      skippedInProgress: skippedInProgress.filter(Boolean),
      bookings: snapshots,
      ...actorFromAdmin(admin),
      note: note || undefined,
    });
  } catch (err) {
    console.error('[tdBookingDeleteAudit] failed to record:', err.message);
    return null;
  }
}

module.exports = {
  snapshotBooking,
  actorFromAdmin,
  recordBookingDeletes,
};
