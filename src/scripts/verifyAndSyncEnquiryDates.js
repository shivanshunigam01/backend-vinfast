/**
 * Verify lead createdAt vs creSheet.enquiryDate and fix mismatches.
 * Usage: node src/scripts/verifyAndSyncEnquiryDates.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
const Lead = require('../models/Lead');

function sameInstant(a, b) {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getTime() === db.getTime();
}

(async () => {
  await connectDB();

  const total = await Lead.countDocuments();
  const withEnquiry = await Lead.countDocuments({
    'creSheet.enquiryDate': { $exists: true, $ne: null },
  });
  const withoutEnquiry = total - withEnquiry;

  const leads = await Lead.find({})
    .select('_id name mobile createdAt creSheet.enquiryDate')
    .lean();

  let mismatched = 0;
  let fixed = 0;
  let missingEnquiry = 0;

  for (const lead of leads) {
    const enquiry = lead.creSheet?.enquiryDate;
    if (!enquiry) {
      missingEnquiry += 1;
      continue;
    }
    if (!sameInstant(lead.createdAt, enquiry)) {
      mismatched += 1;
      await Lead.collection.updateOne(
        { _id: lead._id },
        { $set: { createdAt: enquiry } },
      );
      fixed += 1;
    }
  }

  console.log(JSON.stringify({
    totalLeads: total,
    withEnquiryDate: withEnquiry,
    withoutEnquiryDate: withoutEnquiry,
    mismatchedBeforeFix: mismatched,
    fixed,
    sampleMissing: await Lead.find({
      $or: [
        { 'creSheet.enquiryDate': { $exists: false } },
        { 'creSheet.enquiryDate': null },
      ],
    })
      .select('name mobile createdAt source')
      .limit(5)
      .lean(),
  }, null, 2));

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
