/**
 * One-time: blank sales consultant on unowned leads → "Un-assigned" (matches Excel / reports).
 * Run: node src/scripts/normalizeUnassignedLeadConsultants.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
const Lead = require('../models/Lead');

(async () => {
  await connectDB();
  const res = await Lead.updateMany(
    {
      isDuplicate: { $ne: true },
      $and: [
        { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] },
        {
          $or: [
            { 'creSheet.salesConsultantName': { $exists: false } },
            { 'creSheet.salesConsultantName': null },
            { 'creSheet.salesConsultantName': '' },
          ],
        },
      ],
    },
    { $set: { 'creSheet.salesConsultantName': 'Un-assigned' } },
  );
  console.log('Updated', res.modifiedCount, 'lead(s)');
  process.exit(0);
})();
