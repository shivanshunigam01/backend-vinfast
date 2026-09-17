/**
 * Backfill lead.createdAt from creSheet.enquiryDate for imported rows.
 * Usage: SYNC_ENQUIRY_DATES_CONFIRM=yes node src/scripts/syncLeadEnquiryDates.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
const Lead = require('../models/Lead');

(async () => {
  try {
    if (process.env.SYNC_ENQUIRY_DATES_CONFIRM !== 'yes') {
      console.error('Set SYNC_ENQUIRY_DATES_CONFIRM=yes to run.');
      process.exit(1);
    }
    await connectDB();
    const leads = await Lead.find({
      'creSheet.enquiryDate': { $exists: true, $ne: null },
    }).select('_id creSheet.enquiryDate createdAt').lean();

    let updated = 0;
    for (const lead of leads) {
      const enquiryDate = lead.creSheet?.enquiryDate;
      if (!enquiryDate) continue;
      await Lead.updateOne(
        { _id: lead._id },
        { $set: { createdAt: enquiryDate } },
        { timestamps: false },
      );
      updated += 1;
    }
    console.log(`Synced createdAt from ENQUIRY DATE for ${updated} lead(s).`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
