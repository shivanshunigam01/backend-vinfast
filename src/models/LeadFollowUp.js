const mongoose = require('mongoose');

const INTEREST_LEVELS = ['HOT', 'WARM', 'COLD'];

const leadFollowUpSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', required: true },
    note: { type: String, required: true, trim: true },
    scheduledAt: { type: Date },
    completedAt: { type: Date },
    outcome: { type: String, trim: true },
    nextAction: { type: String, trim: true },
    nextFollowUpAt: { type: Date },
    interestLevel: { type: String, enum: INTEREST_LEVELS },
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  },
  { timestamps: true },
);

leadFollowUpSchema.index({ leadId: 1, createdAt: 1 });
leadFollowUpSchema.index({ leadId: 1, status: 1, scheduledAt: 1 });

module.exports = mongoose.model('LeadFollowUp', leadFollowUpSchema);
module.exports.INTEREST_LEVELS = INTEREST_LEVELS;
