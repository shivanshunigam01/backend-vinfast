const mongoose = require('mongoose');

const leadStageHistorySchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' },
    fromStage: { type: String },
    toStage: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    reason: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('LeadStageHistory', leadStageHistorySchema);
