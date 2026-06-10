const mongoose = require('mongoose');

const LeadStageHistorySchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  fromStage: { type: String },
  toStage: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  changedByType: { type: String, enum: ['Admin', 'Executive', 'System'], default: 'Admin' },
  relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' },
  relatedTDLog: { type: mongoose.Schema.Types.ObjectId, ref: 'TDLog' },
  remarks: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('LeadStageHistory', LeadStageHistorySchema);
