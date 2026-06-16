const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const TestDrive = require('../models/TestDrive');
const LeadStageHistory = require('../models/LeadStageHistory');

const PRE_TD_STAGES = new Set([
  'Enquiry',
  'Interested',
  'New Lead',
  'Contact Attempted',
  'Test Drive Scheduled'
]);

/**
 * Ensure a CRM lead exists for a TD booking and is assigned to the executive.
 */
async function syncLeadFromTDBooking(booking, { changedBy } = {}) {
  if (!booking?.customerId) return null;

  const customer = await Customer.findById(booking.customerId);
  if (!customer) return null;

  let testDrive = null;
  if (booking.testDriveId) {
    testDrive = await TestDrive.findById(booking.testDriveId);
  }

  let lead = null;
  if (customer.leadId) lead = await Lead.findById(customer.leadId);
  if (!lead) lead = await Lead.findOne({ mobile: customer.mobile });

  const executiveId = booking.assignedExecutive?._id || booking.assignedExecutive;
  const targetStatus = booking.bookingStatus === 'COMPLETED'
    ? 'Test Drive Completed'
    : 'Test Drive Booked';

  if (!lead) {
    lead = await Lead.create({
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      city: customer.city,
      model: booking.preferredModel || customer.preferredVehicle || 'VF 7',
      interest: 'Test Drive',
      source: testDrive ? 'Website' : 'Walk-in',
      status: targetStatus,
      assignedTo: executiveId || undefined
    });

    await LeadStageHistory.create({
      leadId: lead._id,
      bookingId: booking._id,
      fromStage: 'Enquiry',
      toStage: targetStatus,
      changedBy,
      reason: 'Lead created from test drive booking assignment'
    });
  } else {
    const prev = lead.status;
    if (executiveId) lead.assignedTo = executiveId;
    if (PRE_TD_STAGES.has(lead.status) || lead.status === 'Test Drive Booked') {
      lead.status = targetStatus;
    }
    if (booking.preferredModel) lead.model = booking.preferredModel;
    await lead.save();

    if (prev !== lead.status) {
      await LeadStageHistory.create({
        leadId: lead._id,
        bookingId: booking._id,
        fromStage: prev,
        toStage: lead.status,
        changedBy,
        reason: 'Updated from test drive booking'
      });
    }
  }

  if (!customer.leadId || String(customer.leadId) !== String(lead._id)) {
    customer.leadId = lead._id;
    await customer.save();
  }

  return lead;
}

module.exports = { syncLeadFromTDBooking };
