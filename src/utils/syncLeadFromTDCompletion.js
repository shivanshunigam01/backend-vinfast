require('../models/tdModels');

const Lead = require('../models/Lead');
const TDCustomer = require('../models/TDCustomer');
const TestDrive = require('../models/TestDrive');
const LeadStageHistory = require('../models/LeadStageHistory');
const { normalizeLeadModelForStorage } = require('./leadModel');

const POST_TD_STAGES = new Set(['Negotiation', 'Booking', 'Delivered', 'Lost']);

function buildCompletionRemarks(log) {
  const parts = ['Test drive completed'];
  if (log.totalKM != null) parts.push(`${log.totalKM} km driven`);
  if (log.durationMinutes != null) parts.push(`${log.durationMinutes} min`);
  return parts.join(' — ');
}

/**
 * When an executive completes a test drive, ensure the customer appears in CRM Leads
 * assigned to that executive with source "Test Drive".
 */
async function syncLeadFromTDCompletion({ log, booking, changedBy }) {
  const executiveId = log?.executiveId || changedBy;
  if (!executiveId) return null;

  let customer = null;
  if (log?.customerId) {
    customer = await TDCustomer.findById(log.customerId);
  }

  const mobile = customer?.mobile || booking?.customerMobile;
  if (!mobile) return null;

  const name = customer?.name || booking?.customerName || 'TD Customer';
  const model = normalizeLeadModelForStorage(booking?.preferredModel || 'VF 7');
  const remarks = buildCompletionRemarks(log);
  const targetStatus = 'Test Drive Completed';

  let lead = await Lead.findOne({ mobile });

  if (!lead) {
    lead = await Lead.create({
      name,
      mobile,
      email: customer?.email || booking?.customerEmail,
      city: customer?.city || booking?.customerCity || 'Unknown',
      model,
      interest: 'Test Drive',
      source: 'Test Drive',
      status: targetStatus,
      assignedTo: executiveId,
      remarks,
    });

    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: booking?._id,
      fromStage: 'Enquiry',
      toStage: targetStatus,
      changedBy: executiveId,
      reason: 'Lead created after test drive completed',
    });
  } else {
    const prevStatus = lead.status;
    const prevAssignee = lead.assignedTo ? String(lead.assignedTo) : null;

    lead.assignedTo = executiveId;
    lead.source = 'Test Drive';
    if (booking?.preferredModel) lead.model = model;
    if (!POST_TD_STAGES.has(lead.status)) {
      lead.status = targetStatus;
    }
    lead.remarks = remarks;
    await lead.save();

    const assigneeChanged = prevAssignee !== String(executiveId);
    const statusChanged = prevStatus !== lead.status;
    if (assigneeChanged || statusChanged) {
      await LeadStageHistory.create({
        leadId: lead._id,
        bookingId: booking?._id,
        fromStage: prevStatus,
        toStage: lead.status,
        changedBy: executiveId,
        reason: assigneeChanged
          ? 'Assigned to executive after test drive completed'
          : 'Updated after test drive completed',
      });
    }
  }

  if (booking?.testDriveId) {
    await TestDrive.findByIdAndUpdate(booking.testDriveId, {
      status: 'Completed',
      leadId: lead._id,
      assignedExecutive: executiveId,
    });
  }

  return lead;
}

module.exports = { syncLeadFromTDCompletion };
