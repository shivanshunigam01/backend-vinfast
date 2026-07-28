const mongoose = require('mongoose');

/**
 * Named permission templates for User Master.
 * When assigned to a TDStaff user, allowedModules/allowedActions are copied onto the user.
 */
const staffRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    /** Coarse auth role used by authorize() middleware. */
    authRole: {
      type: String,
      enum: ['executive', 'manager'],
      default: 'executive',
    },
    allowedModules: { type: [String], default: [] },
    allowedActions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('StaffRole', staffRoleSchema);
