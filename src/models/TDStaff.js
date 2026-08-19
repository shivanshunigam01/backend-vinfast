const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const STAFF_DESIGNATIONS = [
  'sales_executive',
  'cre',
  'sales_manager',
  'sales_head',
  'branch_manager',
  'gm',
  'ceo',
  'md',
];

/** Designations that use the field-staff (executive) portal access level. */
const FIELD_STAFF_DESIGNATIONS = ['sales_executive', 'cre'];

const tdStaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // WhatsApp-capable 10-digit Indian mobile (used for staff password-reset OTP).
    mobile: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      validate: {
        validator(v) {
          if (v == null || v === '') return true;
          return /^[6-9]\d{9}$/.test(String(v));
        },
        message: 'Mobile must be a valid 10-digit Indian number',
      },
    },
    password: { type: String, required: true, minlength: 8, select: false },
    // Viewable copy of the password for the User Master "eye" feature.
    // Only exposed to managers/superadmins via GET /admin/td/users/:id/password.
    passwordPlain: { type: String, select: false },
    role: { type: String, default: 'executive', trim: true },
    // Known keys from STAFF_DESIGNATIONS, or a free-text custom position
    // (e.g. "Telecaller") typed by the admin in User Master.
    designation: { type: String, trim: true, default: 'sales_executive' },
    // Manager this staff member reports to (SE → SM → SH). Null for the top of the chain.
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', default: null },
    /**
     * MIS / Action Centre visibility. Empty = derive from designation.
     * organisation = all teams (Neha, Sales Head, GM/CEO/MD, admin).
     */
    reportsScope: {
      type: String,
      enum: ['self', 'team', 'organisation'],
      trim: true,
    },
    active: { type: Boolean, default: true },
    // Optional named permission template from User Master Roles.
    staffRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffRole', default: null },
    // Admin-panel modules this user may see. Empty = default access for their role.
    allowedModules: { type: [String], default: [] },
    // Optional action-level ACL (e.g. td_bookings:assign). Empty = all actions for allowed modules.
    allowedActions: { type: [String], default: [] },
  },
  { timestamps: true },
);

tdStaffSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const plain = String(this.password || '');
  if (plain.length < 8) {
    return next(new Error('Password must be at least 8 characters'));
  }
  // Keep a recoverable copy for User Master preview, then store the bcrypt hash for login.
  this.passwordPlain = plain;
  this.password = await bcrypt.hash(plain, 12);
  next();
});

tdStaffSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('TDStaff', tdStaffSchema);
module.exports.STAFF_DESIGNATIONS = STAFF_DESIGNATIONS;
module.exports.FIELD_STAFF_DESIGNATIONS = FIELD_STAFF_DESIGNATIONS;
