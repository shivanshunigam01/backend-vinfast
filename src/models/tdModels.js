/**
 * Register all TD-related Mongoose models before any populate() calls.
 * Import this once from TD controllers/routes.
 */
require('./TDBranch');
require('./TDCustomer');
require('./TDVehicle');
require('./TDStaff');
require('./TDBooking');
require('./TDSlotConfig');
require('./TDFeedback');
require('./TDLog');
require('./TestDrive');
require('./Admin');
require('./LeadFollowUp');
require('./LeadStageHistory');

module.exports = {};
