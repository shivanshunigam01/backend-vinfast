const mongoose = require('mongoose');

const LeadFollowUpSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  note: { type: String, required: true, trim: true },
  /** When the executive plans to call / meet the customer */
  scheduledAt: { type: Date },
  completedAt: { type: Date },
  outcome: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('LeadFollowUp', LeadFollowUpSchema);
