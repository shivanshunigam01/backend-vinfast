require('dotenv').config();
const connectDB = require('../config/db');
const LeadFollowUp = require('../models/LeadFollowUp');

(async () => {
  await connectDB();
  const rows = await LeadFollowUp.find({
    scheduledAt: { $exists: true, $ne: null },
    status: 'completed',
  }).select('_id scheduledAt completedAt');

  let fixed = 0;
  for (const row of rows) {
    const scheduled = new Date(row.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) continue;
    await LeadFollowUp.updateOne({ _id: row._id }, { $set: { completedAt: scheduled } });
    fixed += 1;
  }
  console.log(`Updated completedAt on ${fixed} follow-up(s).`);
  process.exit(0);
})();
