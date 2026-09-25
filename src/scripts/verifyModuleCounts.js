require('dotenv').config();
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const TDBooking = require('../models/TDBooking');
const { applyLeadModuleViewFilter } = require('../utils/leadModuleFilters');

(async () => {
  await connectDB();
  const base = { isDuplicate: { $ne: true } };
  const crmQ = applyLeadModuleViewFilter({ ...base }, 'crm');
  const tdQ = applyLeadModuleViewFilter({ ...base }, 'td');
  const bookingQ = applyLeadModuleViewFilter({ ...base }, 'booking');

  console.log({
    total: await Lead.countDocuments(base),
    crm: await Lead.countDocuments(crmQ),
    td: await Lead.countDocuments(tdQ),
    booking: await Lead.countDocuments(bookingQ),
    tdBookings: await TDBooking.countDocuments(),
    bookingDone: await Lead.countDocuments({ ...base, 'creSheet.bookingDone': true }),
    tdDone: await Lead.countDocuments({ ...base, 'creSheet.tdDone': true }),
    unassigned: await Lead.countDocuments({ ...base, assignedTo: null }),
  });
  process.exit(0);
})();
