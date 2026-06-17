const mongoose = require('mongoose');

const leadFollowUpSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', required: true },
    note: { type: String, required: true, trim: true },
    scheduledAt: { type: Date },
    completedAt: { type: Date },
    outcome: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('LeadFollowUp', leadFollowUpSchema);
