module.exports = {
  // --- Existing routes ---
  auth: require('./auth'),
  settings: require('./settings'),
  whatsappOtp: require('./whatsappOtp'),
  public: require('./public'),
  publicLeads: require('./leads'),
  publicTestDrives: require('./testDrives'),
  publicEnquiries: require('./enquiries'),
  dashboard: require('./dashboard'),
  adminLeads: require('./adminLeads'),
  adminMetaLeads: require('./adminMetaLeads'),
  adminTestDrives: require('./adminTestDrives'),
  adminEnquiries: require('./adminEnquiries'),
  products: require('./products'),
  offers: require('./offers'),
  homepage: require('./homepage'),
  content: require('./content'),
  media: require('./media'),

  // --- Test Drive Management Module ---
  tdBranches: require('./td/branches'),
  tdCustomers: require('./td/customers').router,
  tdDemoVehicles: require('./td/demoVehicles'),
  tdBookings: require('./td/tdBookings'),
  tdSlots: require('./td/tdSlots'),
  tdLogs: require('./td/tdLogs'),
  tdFeedback: require('./td/tdFeedback'),
  tdReports: require('./td/tdReports'),
  tdStaffUsers: require('./td/staffUsers'),
  tdLeadCrm: require('./td/leadCrm'),

  // Customer portal
  customerAuth: require('./customerAuth'),
  customerBookings: require('./customerBookings')
};
