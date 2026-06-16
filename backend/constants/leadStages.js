/** Canonical CRM pipeline stages (executive / manager lead management). */
const CRM_LEAD_STAGES = [
  'Enquiry',
  'Interested',
  'Test Drive Booked',
  'Test Drive Completed',
  'Negotiation',
  'Booking',
  'Delivered',
  'Lost'
];

/** Legacy values still stored on older records — shown in UI, mappable to CRM stages. */
const LEGACY_LEAD_STAGES = [
  'New Lead',
  'Contact Attempted',
  'Test Drive Scheduled',
  'Booked',
  'Not Interested',
  'TEST_DRIVE_FEEDBACK'
];

const ALL_LEAD_STAGES = [...CRM_LEAD_STAGES, ...LEGACY_LEAD_STAGES];

const LEGACY_TO_CRM = {
  'New Lead': 'Enquiry',
  'Contact Attempted': 'Enquiry',
  'Test Drive Scheduled': 'Test Drive Booked',
  Booked: 'Booking',
  'Not Interested': 'Lost',
  TEST_DRIVE_FEEDBACK: 'Test Drive Completed'
};

function normalizeStageLabel(stage) {
  if (!stage) return 'Enquiry';
  return LEGACY_TO_CRM[stage] || stage;
}

function isCrmStaffRole(role) {
  return ['executive', 'manager', 'superadmin'].includes(role);
}

module.exports = {
  CRM_LEAD_STAGES,
  LEGACY_LEAD_STAGES,
  ALL_LEAD_STAGES,
  LEGACY_TO_CRM,
  normalizeStageLabel,
  isCrmStaffRole
};
