require('../models/tdModels');

const PVCustomer = require('../models/PVCustomer');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const LeadFollowUp = require('../models/LeadFollowUp');
const TDCustomer = require('../models/TDCustomer');
const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDFeedback = require('../models/TDFeedback');
const PostDeliveryFeedback = require('../models/PostDeliveryFeedback');
const { normalizeStageLabel } = require('../constants/leadStages');

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'];

function normalizeMobile(raw) {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

/**
 * Test-drive state for a customer mobile — drives the CRM "Book Test Drive" /
 * "Test Drive Done" button visibility and the repeat-drive approval rule.
 */
async function getCustomerTestDriveState(mobile) {
  const mobileNorm = normalizeMobile(mobile);
  if (!mobileNorm) {
    return {
      hasCompletedTestDrive: false,
      hasActiveBooking: false,
      hasPendingApproval: false,
      canBookTestDrive: true,
      repeatRequiresAdminApproval: false,
      bookings: [],
    };
  }

  const tdCustomers = await TDCustomer.find({ mobile: mobileNorm }).select('_id').lean();
  const bookingQuery = {
    $or: [
      { customerMobile: mobileNorm },
      ...(tdCustomers.length ? [{ customerId: { $in: tdCustomers.map((c) => c._id) } }] : []),
    ],
  };

  const bookings = await TDBooking.find(bookingQuery)
    .select('bookingId bookingStatus slotDate slotTime preferredModel isRepeatDrive approvalStatus approvalNote leadId createdAt')
    .sort({ slotDate: -1, createdAt: -1 })
    .lean();

  const hasCompletedTestDrive = bookings.some((b) => b.bookingStatus === 'COMPLETED');
  const hasActiveBooking = bookings.some(
    (b) => ACTIVE_BOOKING_STATUSES.includes(b.bookingStatus) && b.approvalStatus !== 'REJECTED',
  );
  const hasPendingApproval = bookings.some(
    (b) => b.approvalStatus === 'PENDING' && ACTIVE_BOOKING_STATUSES.includes(b.bookingStatus),
  );

  return {
    hasCompletedTestDrive,
    hasActiveBooking,
    hasPendingApproval,
    canBookTestDrive: !hasActiveBooking,
    repeatRequiresAdminApproval: hasCompletedTestDrive,
    bookings,
  };
}

function pushEvent(timeline, event) {
  if (!event.at) return;
  timeline.push(event);
}

/**
 * Complete lifecycle history of a customer: every lead (source, enquiry date,
 * executive), status changes, follow-ups, test drives (booked + completed),
 * feedback, referrals, and sale conversions. Powers the CRM history popup.
 */
async function buildCustomerHistory(customer) {
  const mobileNorm = normalizeMobile(customer.mobile);

  const leads = await Lead.find({
    $or: [{ pvCustomerId: customer._id }, ...(mobileNorm ? [{ mobile: mobileNorm }] : [])],
  })
    .populate('assignedTo', 'name email designation')
    .populate('convertedCustomerId', 'customerId name mobile')
    .sort({ createdAt: 1 })
    .lean();

  const leadIds = leads.map((l) => l._id);

  const tdCustomers = mobileNorm
    ? await TDCustomer.find({ mobile: mobileNorm }).select('_id').lean()
    : [];

  const [stageHistory, followUps, bookings, referralsMade, postDeliveryFeedbacks] = await Promise.all([
    LeadStageHistory.find({ leadId: { $in: leadIds } })
      .populate('changedBy', 'name email')
      .sort({ createdAt: 1 })
      .lean(),
    LeadFollowUp.find({ leadId: { $in: leadIds } })
      .populate('createdBy', 'name email')
      .sort({ createdAt: 1 })
      .lean(),
    TDBooking.find({
      $or: [
        { leadId: { $in: leadIds } },
        ...(mobileNorm ? [{ customerMobile: mobileNorm }] : []),
        ...(tdCustomers.length ? [{ customerId: { $in: tdCustomers.map((c) => c._id) } }] : []),
      ],
    })
      .populate('assignedExecutive', 'name email')
      .populate('vehicleId', 'vehicleId model registrationNo')
      .sort({ createdAt: 1 })
      .lean(),
    Lead.find({
      $or: [
        { referredByCustomerId: customer._id },
        ...(mobileNorm ? [{ referredByMobile: mobileNorm }] : []),
      ],
    })
      .select('leadId name mobile model source status createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    mobileNorm ? PostDeliveryFeedback.find({ mobile: mobileNorm }).sort({ createdAt: 1 }).lean() : [],
  ]);

  const bookingIds = bookings.map((b) => b._id);
  const [logs, tdFeedbacks] = await Promise.all([
    bookingIds.length ? TDLog.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: 1 }).lean() : [],
    bookingIds.length ? TDFeedback.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: 1 }).lean() : [],
  ]);

  const bookingById = new Map(bookings.map((b) => [String(b._id), b]));
  const timeline = [];

  for (const lead of leads) {
    pushEvent(timeline, {
      type: 'lead_created',
      at: lead.createdAt,
      title: `Enquiry received (${lead.leadId || 'lead'})`,
      detail: `Source: ${lead.source || 'Unknown'} · Model: ${lead.model || '—'} · Opportunity: ${lead.opportunityId || '—'}`,
      leadId: String(lead._id),
      source: lead.source || null,
      model: lead.model || null,
      executive: lead.assignedTo?.name || null,
    });
    if (lead.convertedAt) {
      pushEvent(timeline, {
        type: 'sale_conversion',
        at: lead.convertedAt,
        title: 'Opportunity converted to sale',
        detail: `Buyer: ${lead.convertedCustomerId?.name || lead.name} (${lead.convertedCustomerId?.customerId || '—'})`,
        leadId: String(lead._id),
        customerId: lead.convertedCustomerId?.customerId || null,
      });
    }
  }

  for (const h of stageHistory) {
    const isAssignment = h.reason?.startsWith('Assignment:');
    const isEdit = h.reason?.startsWith('Details updated');
    pushEvent(timeline, {
      type: isAssignment ? 'assignment' : isEdit ? 'edit' : 'status_change',
      at: h.createdAt,
      title: isAssignment
        ? 'Executive assignment'
        : isEdit
          ? 'Lead details updated'
          : `Status: ${h.fromStage || '—'} → ${h.toStage}`,
      detail: h.reason || '',
      leadId: String(h.leadId),
      by: h.changedBy?.name || 'System',
    });
  }

  for (const f of followUps) {
    pushEvent(timeline, {
      type: 'follow_up',
      at: f.createdAt,
      title: f.status === 'completed' ? 'Follow-up / call done' : 'Follow-up scheduled',
      detail: `${f.note}${f.outcome ? ` · ${f.outcome}` : ''}`,
      leadId: String(f.leadId),
      by: f.createdBy?.name || '—',
      status: f.status,
    });
  }

  for (const b of bookings) {
    pushEvent(timeline, {
      type: 'test_drive_booked',
      at: b.createdAt,
      title: `Test drive booked (${b.bookingId})${b.isRepeatDrive ? ' — repeat' : ''}`,
      detail: `${b.preferredModel || '—'} · ${b.slotDate ? new Date(b.slotDate).toLocaleDateString('en-IN') : '—'} ${b.slotTime || ''} · Status: ${b.bookingStatus}${b.approvalStatus && b.approvalStatus !== 'NOT_REQUIRED' ? ` · Approval: ${b.approvalStatus}` : ''}`,
      bookingId: String(b._id),
      executive: b.assignedExecutive?.name || null,
    });
  }

  for (const log of logs) {
    if (log.status !== 'COMPLETED') continue;
    const booking = bookingById.get(String(log.bookingId));
    pushEvent(timeline, {
      type: 'test_drive_completed',
      at: log.endTime || log.updatedAt,
      title: `Test drive completed${booking ? ` (${booking.bookingId})` : ''}`,
      detail: `${log.totalKM != null ? `${log.totalKM} km` : '—'}${log.durationMinutes != null ? ` · ${log.durationMinutes} min` : ''}${log.executiveRemarks ? ` · ${log.executiveRemarks}` : ''}`,
      bookingId: String(log.bookingId),
      customerPhotoUrl: log.customerPhotoUrl || null,
      location: log.endLocation?.lat != null ? { lat: log.endLocation.lat, lng: log.endLocation.lng } : null,
    });
  }

  for (const fb of tdFeedbacks) {
    pushEvent(timeline, {
      type: 'feedback',
      at: fb.createdAt,
      title: 'Test drive feedback',
      detail: `Overall ${fb.overallRating ?? '—'}⭐ · Purchase intent ${fb.purchaseIntention ?? '—'}/5${fb.remarks ? ` · ${fb.remarks}` : ''}`,
      bookingId: String(fb.bookingId),
      rating: fb.overallRating ?? null,
    });
  }

  for (const fb of postDeliveryFeedbacks) {
    pushEvent(timeline, {
      type: 'post_delivery_feedback',
      at: fb.createdAt,
      title: 'Post-delivery feedback',
      detail: `Overall journey ${fb.ratings?.overallJourney ?? '—'}⭐${fb.comment ? ` · ${fb.comment}` : ''}`,
      rating: fb.ratings?.overallJourney ?? null,
    });
  }

  for (const ref of referralsMade) {
    pushEvent(timeline, {
      type: 'referral',
      at: ref.createdAt,
      title: `Referred ${ref.name}`,
      detail: `${ref.mobile} · ${ref.model || '—'} · Lead ${ref.leadId || '—'} (${normalizeStageLabel(ref.status)})`,
      referredLeadId: String(ref._id),
    });
  }

  timeline.sort((a, b) => new Date(b.at) - new Date(a.at));

  const testDriveState = {
    hasCompletedTestDrive: bookings.some((b) => b.bookingStatus === 'COMPLETED'),
    hasActiveBooking: bookings.some(
      (b) => ACTIVE_BOOKING_STATUSES.includes(b.bookingStatus) && b.approvalStatus !== 'REJECTED',
    ),
    hasPendingApproval: bookings.some(
      (b) => b.approvalStatus === 'PENDING' && ACTIVE_BOOKING_STATUSES.includes(b.bookingStatus),
    ),
  };

  return {
    customer: {
      _id: customer._id,
      customerId: customer.customerId,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email || null,
      city: customer.city || null,
      since: customer.createdAt,
    },
    summary: {
      firstEnquiryAt: leads[0]?.createdAt || customer.createdAt,
      totalLeads: leads.length,
      openLeads: leads.filter((l) => !['Delivered', 'Lost'].includes(normalizeStageLabel(l.status))).length,
      testDrivesBooked: bookings.length,
      testDrivesCompleted: bookings.filter((b) => b.bookingStatus === 'COMPLETED').length,
      followUps: followUps.length,
      feedbacks: tdFeedbacks.length + postDeliveryFeedbacks.length,
      referralsMade: referralsMade.length,
      purchases: leads.filter((l) => l.convertedAt || normalizeStageLabel(l.status) === 'Delivered').length,
      ...testDriveState,
      canBookTestDrive: !testDriveState.hasActiveBooking,
      repeatRequiresAdminApproval: testDriveState.hasCompletedTestDrive,
    },
    leads: leads.map((l) => ({
      _id: l._id,
      leadId: l.leadId,
      opportunityId: l.opportunityId,
      model: l.model,
      source: l.source,
      status: normalizeStageLabel(l.status),
      executive: l.assignedTo?.name || null,
      enquiryDate: l.createdAt,
      converted: Boolean(l.convertedAt),
      convertedCustomer: l.convertedCustomerId
        ? { customerId: l.convertedCustomerId.customerId, name: l.convertedCustomerId.name }
        : null,
    })),
    bookings: bookings.map((b) => ({
      _id: b._id,
      bookingId: b.bookingId,
      bookingStatus: b.bookingStatus,
      slotDate: b.slotDate,
      slotTime: b.slotTime,
      model: b.preferredModel,
      isRepeat: Boolean(b.isRepeatDrive),
      approvalStatus: b.approvalStatus || 'NOT_REQUIRED',
      executive: b.assignedExecutive?.name || null,
      vehicle: b.vehicleId
        ? { model: b.vehicleId.model, registrationNo: b.vehicleId.registrationNo }
        : null,
    })),
    referralsMade,
    timeline,
  };
}

/** Find the parent PVCustomer for a mobile number (popup lookup). */
async function findCustomerByMobile(mobile) {
  const mobileNorm = normalizeMobile(mobile);
  if (!mobileNorm) return null;
  return PVCustomer.findOne({ mobile: mobileNorm, isSubCustomer: { $ne: true } });
}

module.exports = {
  buildCustomerHistory,
  getCustomerTestDriveState,
  findCustomerByMobile,
  normalizeMobile,
  ACTIVE_BOOKING_STATUSES,
};
