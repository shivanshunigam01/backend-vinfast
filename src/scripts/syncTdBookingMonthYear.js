require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const Lead = require('../models/Lead');
const { syncTestDriveBookingFromCreSheet } = require('../utils/crmCreSheetSync');

(async () => {
  await connectDB();
  const leads = await Lead.find({
    $or: [{ 'creSheet.monthYear': { $exists: true, $ne: null } }, { 'creSheet.tdDate': { $exists: true, $ne: null } }],
  }).select('_id assignedTo creSheet');
  let n = 0;
  for (const lead of leads) {
    if (lead.creSheet?.tdDate || lead.creSheet?.tdDone) {
      await syncTestDriveBookingFromCreSheet(lead, { assigneeId: lead.assignedTo });
      n += 1;
    }
  }
  console.log(`Synced ${n} TD booking(s).`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
