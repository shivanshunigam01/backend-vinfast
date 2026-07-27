const mongoose = require('mongoose');

const TD_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
  'MISSED',
];

/** Approval workflow for repeat test drives requested by executives. */
const TD_APPROVAL_STATUSES = ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'];

/** Assigned executive must Accept or Reject; rejected → requeue for reassignment. */
const TD_ASSIGNMENT_STATUSES = ['UNASSIGNED', 'PENDING_ACCEPTANCE', 'ACCEPTED', 'REJECTED'];

const tdBookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, trim: true, index: true },
    bookingStatus: { type: String, enum: TD_BOOKING_STATUSES, default: 'PENDING' },
    slotDate: { type: Date, required: true, index: true },
    slotTime: { type: String, required: true, trim: true },
    slotDuration: { type: Number, default: 60 },
    dlVerified: { type: Boolean, default: false },
    dlImageUrl: { type: String, trim: true },
    dlImagePublicId: { type: String, trim: true },
    dlVerifiedAt: { type: Date },
    dlNumber: { type: String, trim: true, uppercase: true },
    dlValidUntil: { type: Date },
    preferredModel: { type: String, trim: true },
    remarks: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDCustomer' },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDVehicle' },
    // Repeat test drive (customer already completed one for this model) — needs manager/superadmin approval.
    isRepeatDrive: { type: Boolean, default: false },
    repeatApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    // Executive-raised repeat requests await a manager/superadmin decision here.
    approvalStatus: { type: String, enum: TD_APPROVAL_STATUSES, default: 'NOT_REQUIRED', index: true },
    approvalRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    approvalDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    approvalDecidedAt: { type: Date },
    approvalNote: { type: String, trim: true },
    // CRM lead this booking was raised from (Book Test Drive inside CRM).
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    assignedExecutiveEmail: { type: String, trim: true, lowercase: true, index: true },
    assignmentStatus: {
      type: String,
      enum: TD_ASSIGNMENT_STATUSES,
      default: 'UNASSIGNED',
      index: true,
    },
    assignmentRespondedAt: { type: Date },
    assignmentRejectReason: { type: String, trim: true },
    rescheduleCount: { type: Number, default: 0 },
    pendingRescheduleRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TDRescheduleRequest',
    },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    testDriveId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestDrive' },
    // Legacy / denormalized customer fields from website sync
    customerName: { type: String, trim: true },
    customerMobile: { type: String, trim: true },
    customerEmail: { type: String, trim: true },
    customerCity: { type: String, trim: true },
    customerLat: { type: Number },
    customerLng: { type: Number },
    customerAddress: { type: String, trim: true },
  },
  { timestamps: true, strict: false },
);

module.exports = mongoose.model('TDBooking', tdBookingSchema);
module.exports.TD_BOOKING_STATUSES = TD_BOOKING_STATUSES;
module.exports.TD_APPROVAL_STATUSES = TD_APPROVAL_STATUSES;
module.exports.TD_ASSIGNMENT_STATUSES = TD_ASSIGNMENT_STATUSES;
