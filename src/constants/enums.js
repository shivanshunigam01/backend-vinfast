
module.exports = {
  adminRoles: ['superadmin', 'manager', 'executive'],
  leadStatuses: [
    'New Lead',
    'Contact Attempted',
    'Interested',
    'Test Drive Scheduled',
    'Negotiation',
    'Booked',
    'Lost',
    'Dormant',
  ],
  testDriveStatuses: ['Pending', 'Scheduled', 'Completed', 'Cancelled', 'No Show'],
  enquiryStatuses: ['Open', 'In Progress', 'Responded', 'Closed'],
  /** Lead.model allows Both; TestDrive/Enquiry.model use concrete lines only (see models). */
  productModels: ['VF 6', 'VF 7', 'VF MPV 7', 'Both'],
  enquiryInterests: [
    'General Enquiry',
    'Get On-Road Price',
    'Book Test Drive',
    'Finance Support',
    'Exchange Car',
    'Corporate/Fleet',
    'Service',
  ],
  resourceTypes: ['image', 'video'],
  testDrivePreferredLocations: ['Dealership Visit', 'Home Test Drive'],
  yesNo: ['Yes', 'No'],
  purchaseTimelines: ['0-1 Month', '1-3 Months', '3-6 Months', 'Just Exploring'],
};
