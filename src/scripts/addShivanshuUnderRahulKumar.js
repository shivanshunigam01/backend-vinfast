/**
 * One-off: add Sales Executive Shivanshu under Rahul Kumar (SM). No lead/TD assignment.
 * Usage: node src/scripts/addShivanshuUnderRahulKumar.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
require('../models/tdModels');
const TDStaff = require('../models/TDStaff');
const mongoose = require('mongoose');

const EXEC = {
  name: 'Shivanshu',
  email: 'shivanshu@patliputravinfast.com',
  mobile: '9812345678',
  designation: 'sales_executive',
};

const DEFAULT_PASSWORD = process.env.SEED_TD_TEAM_PASSWORD || 'Patliputra@123';

(async () => {
  await connectDB();

  const manager = await TDStaff.findOne({
    active: { $ne: false },
    $or: [
      { email: 'rahul.kumar@patliputravinfast.com' },
      { name: /^Rahul Kumar$/i, designation: { $in: ['sales_manager', 'branch_manager'] } },
    ],
  });

  if (!manager) {
    console.error('Rahul Kumar (Sales Manager) not found in User Master.');
    process.exit(1);
  }

  const normEmail = EXEC.email.toLowerCase();
  let doc = await TDStaff.findOne({ email: normEmail });

  if (doc) {
    doc.name = EXEC.name;
    doc.designation = EXEC.designation;
    doc.role = 'executive';
    doc.reportsTo = manager._id;
    doc.active = true;
    if (!doc.mobile) doc.mobile = EXEC.mobile;
    await doc.save();
    console.log(`Updated existing user: ${doc.name} → reports to ${manager.name} (${manager._id})`);
  } else {
    const mobileTaken = await TDStaff.findOne({ mobile: EXEC.mobile });
    const mobile = mobileTaken ? undefined : EXEC.mobile;
    doc = await TDStaff.create({
      name: EXEC.name,
      email: normEmail,
      mobile,
      password: DEFAULT_PASSWORD,
      designation: EXEC.designation,
      role: 'executive',
      reportsTo: manager._id,
      active: true,
      allowedModules: [],
      allowedActions: [],
    });
    console.log(`Created ${doc.name} <${doc.email}> → reports to ${manager.name}`);
    if (!mobile) console.log('(mobile omitted — number already in use; set in User Master)');
    console.log(`Login password (new user only): ${DEFAULT_PASSWORD}`);
  }

  console.log('No leads or test drives were assigned.');
  await mongoose.connection.close();
  process.exit(0);
})().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
