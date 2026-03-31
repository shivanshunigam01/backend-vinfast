require('dotenv').config();
const readline = require('readline');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

(async () => {
  try {
    await connectDB();

    const name = process.env.ADMIN_NAME || await ask('Admin name: ');
    const email = (process.env.ADMIN_EMAIL || await ask('Admin email: ')).toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD || await ask('Admin password: ');
    const role = process.env.ADMIN_ROLE || 'superadmin';

    const exists = await Admin.findOne({ email });
    if (exists) {
      console.log('Admin already exists for this email.');
      process.exit(0);
    }

    const admin = await Admin.create({ name, email, password, role });
    console.log(`Admin created successfully: ${admin.email} (${admin.role})`);
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
})();
