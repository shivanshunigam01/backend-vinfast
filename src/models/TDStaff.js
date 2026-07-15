const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const STAFF_DESIGNATIONS = [
  'sales_executive',
  'sales_manager',
  'sales_head',
  'branch_manager',
  'gm',
  'ceo',
  'md',
];

const tdStaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, default: 'executive', trim: true },
    // Known keys from STAFF_DESIGNATIONS, or a free-text custom position
    // (e.g. "Telecaller") typed by the admin in User Master.
    designation: { type: String, trim: true, default: 'sales_executive' },
    // Manager this staff member reports to (SE → SM → SH). Null for the top of the chain.
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', default: null },
    active: { type: Boolean, default: true },
    // Admin-panel modules this user may see. Empty = default access for their role.
    allowedModules: { type: [String], default: [] },
  },
  { timestamps: true },
);

tdStaffSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

tdStaffSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('TDStaff', tdStaffSchema);
module.exports.STAFF_DESIGNATIONS = STAFF_DESIGNATIONS;
