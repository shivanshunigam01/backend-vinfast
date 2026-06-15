const mongoose = require('mongoose');

const tdBranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true },
    city: { type: String, trim: true },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TDBranch', tdBranchSchema);
