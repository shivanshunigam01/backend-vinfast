require('../models/tdModels');

const Lead = require('../models/Lead');
const TDCustomer = require('../models/TDCustomer');
const TDStaff = require('../models/TDStaff');
const TestDrive = require('../models/TestDrive');
const LeadStageHistory = require('../models/LeadStageHistory');
const { normalizeLeadModelForStorage } = require('./leadModel');
const { intakePvLead } = require('./pvLeadIntake');
const { toObjectId, normalizeEmail } = require('./leadAssignment');

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

  const executiveOid = toObjectId(executiveId) || executiveId;
  let executiveEmail;
  if (executiveOid) {
    const execDoc = await TDStaff.findById(executiveOid).select('email').lean();
    executiveEmail = normalizeEmail(execDoc?.email);
  }

  const { lead } = await intakePvLead({
    name,
    mobile,
    email: customer?.email || booking?.customerEmail,
    city: customer?.city || booking?.customerCity || 'Unknown',
    model,
    interest: 'Test Drive',
    source: 'Test Drive',
    status: targetStatus,
    assignedTo: executiveOid,
    assignedToEmail: executiveEmail,
    remarks,
    tdBookingId: booking?._id,
    testDriveId: booking?.testDriveId,
    changedBy: executiveOid,
    historyReason: 'Lead synced after test drive completed',
  });

  if (lead && !POST_TD_STAGES.has(lead.status)) {
    const prevStatus = lead.status;
    if (prevStatus !== targetStatus) {
      lead.status = targetStatus;
      lead.assignedTo = executiveOid;
      lead.assignedToEmail = executiveEmail;
      lead.source = 'Test Drive';
      lead.remarks = remarks;
      await lead.save();
    }
  }

  if (booking?.testDriveId) {
    await TestDrive.findByIdAndUpdate(booking.testDriveId, {
      status: 'Completed',
      leadId: lead._id,
      assignedExecutive: executiveOid,
    });
  }

  return lead;
}

module.exports = { syncLeadFromTDCompletion };
