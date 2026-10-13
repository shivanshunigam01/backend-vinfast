require('dotenv').config();
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const PVCustomer = require('../models/PVCustomer');
const mongoose = require('mongoose');

const mobile = process.argv[2] || '9122162765';

(async () => {
  await connectDB();
  const c = await PVCustomer.findOne({ mobile }).lean();
  console.log('Customer:', c ? { customerId: c.customerId, _id: c._id, name: c.name } : null);
  const leads = await Lead.find({ mobile }).lean();
  console.log('Leads by mobile:', leads.length);
  for (const l of leads) {
    console.log({
      leadId: l.leadId,
      status: l.status,
      isDuplicate: l.isDuplicate,
      duplicateOf: l.duplicateOf,
      pvCustomerId: l.pvCustomerId,
    });
  }
  if (c) {
    const byCust = await Lead.find({ pvCustomerId: c._id }).lean();
    console.log('Leads by pvCustomerId:', byCust.length);
  }
  await mongoose.connection.close();
})();
