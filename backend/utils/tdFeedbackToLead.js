const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const LeadStageHistory = require('../models/LeadStageHistory');

function normalizeLeadModel(preferredModel, preferredVariant) {
  const combined = `${preferredModel || ''} ${preferredVariant || ''}`.toUpperCase();
  if (combined.includes('VF 6') || combined.includes('VF6')) return 'VF 6';
  if (combined.includes('BOTH')) return 'Both';
  if (combined.includes('VF 7') || combined.includes('VF7')) return 'VF 7';
  if (['VF 6', 'VF 7', 'Both'].includes(preferredModel)) return preferredModel;
  return 'VF 7';
}

function leadStatusFromPurchaseIntent(score) {
  if (!score) return 'Test Drive Completed';
  if (score >= 4) return 'Interested';
  if (score === 3) return 'Test Drive Completed';
  return 'Lost';
}

function buildFeedbackRemarks(feedback, booking) {
  const parts = [
    booking?.bookingId && `Test drive feedback (${booking.bookingId})`,
    feedback.overallRating != null && `Overall: ${feedback.overallRating}/5`,
    feedback.purchaseIntention != null && `Purchase intent: ${feedback.purchaseIntention}/5`,
    feedback.preferredVariant && `Preferred variant: ${feedback.preferredVariant}`,
    feedback.drivingExperience != null && `Driving: ${feedback.drivingExperience}/5`,
    feedback.vehicleComfort != null && `Comfort: ${feedback.vehicleComfort}/5`,
    feedback.batteryConfidence != null && `Battery confidence: ${feedback.batteryConfidence}/5`,
    feedback.executiveBehaviour != null && `Executive: ${feedback.executiveBehaviour}/5`,
    feedback.remarks
  ].filter(Boolean);
  return parts.join(' | ');
}

function resolveLeadSource(booking) {
  return booking?.testDriveId ? 'Website' : 'Walk-in';
}

/**
 * Create or update a CRM Lead when TD feedback is captured by the executive.
 */
async function syncLeadFromTDFeedback({ bookingId, feedback, changedBy }) {
  const booking = await TDBooking.findById(bookingId)
    .populate('assignedExecutive', '_id name');
  if (!booking) return null;

  const customer = await Customer.findById(feedback.customerId || booking.customerId);
  if (!customer) return null;

  let testDrive = null;
  if (booking.testDriveId) {
    testDrive = await TestDrive.findById(booking.testDriveId);
  }

  const model = normalizeLeadModel(
    booking.preferredModel || customer.preferredVehicle,
    feedback.preferredVariant || testDrive?.variant
  );
  const nextStatus = leadStatusFromPurchaseIntent(feedback.purchaseIntention);
  const remarks = buildFeedbackRemarks(feedback, booking);

  let lead = null;
  if (customer.leadId) {
    lead = await Lead.findById(customer.leadId);
  }
  if (!lead) {
    lead = await Lead.findOne({ mobile: customer.mobile });
  }

  const assignedTo = booking.assignedExecutive?._id || booking.assignedExecutive || undefined;
  const exchangeNeeded = Boolean(
    testDrive?.ownsCar && !['no', 'none', 'n'].includes(String(testDrive.ownsCar).trim().toLowerCase())
  );

  if (!lead) {
    lead = await Lead.create({
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      city: customer.city,
      model,
      interest: 'Test Drive',
      source: resolveLeadSource(booking),
      status: nextStatus,
      assignedTo,
      remarks,
      exchangeNeeded
    });

    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: booking._id,
      fromStage: 'Enquiry',
      toStage: nextStatus,
      changedBy,
      reason: 'Lead created from test drive feedback'
    });
  } else {
    const prevStatus = lead.status;
    lead.name = customer.name || lead.name;
    lead.mobile = customer.mobile || lead.mobile;
    if (customer.email) lead.email = customer.email;
    if (customer.city) lead.city = customer.city;
    lead.model = model;
    lead.interest = 'Test Drive';
    if (!lead.source || lead.source === 'Website') {
      lead.source = resolveLeadSource(booking);
    }
    lead.status = nextStatus;
    if (assignedTo) lead.assignedTo = assignedTo;
    lead.remarks = remarks;
    if (exchangeNeeded) lead.exchangeNeeded = true;
    await lead.save();

    if (prevStatus !== nextStatus) {
      await LeadStageHistory.create({
        leadId: lead._id,
        bookingId: booking._id,
        fromStage: prevStatus,
        toStage: nextStatus,
        changedBy,
        reason: 'Updated from test drive feedback'
      });
    }
  }

  if (!customer.leadId || String(customer.leadId) !== String(lead._id)) {
    customer.leadId = lead._id;
    await customer.save();
  }

  const historyExists = await LeadStageHistory.findOne({
    leadId: lead._id,
    bookingId: booking._id,
    toStage: 'TEST_DRIVE_FEEDBACK'
  });
  if (!historyExists) {
    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: booking._id,
      fromStage: lead.status,
      toStage: 'TEST_DRIVE_FEEDBACK',
      changedBy,
      reason: `Feedback captured — purchase intent ${feedback.purchaseIntention ?? '—'}/5`
    });
  }

  if (booking.testDriveId) {
    await TestDrive.findByIdAndUpdate(booking.testDriveId, {
      status: 'Completed',
      feedback: feedback.remarks || remarks,
      feedbackRating: feedback.overallRating || feedback.purchaseIntention,
      leadId: lead._id
    });
  } else {
    const websiteTd = await TestDrive.findOne({ tdBookingId: booking._id });
    if (websiteTd) {
      await TestDrive.findByIdAndUpdate(websiteTd._id, {
        status: 'Completed',
        feedback: feedback.remarks || remarks,
        feedbackRating: feedback.overallRating || feedback.purchaseIntention,
        leadId: lead._id
      });
      if (!booking.testDriveId) {
        booking.testDriveId = websiteTd._id;
        await booking.save();
      }
    }
  }

  return lead;
}

module.exports = {
  syncLeadFromTDFeedback,
  normalizeLeadModel,
  leadStatusFromPurchaseIntent,
  buildFeedbackRemarks
};
