const mongoose = require('mongoose');

const leadStageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    color: { type: String, trim: true, default: 'bg-slate-500/15 text-slate-700' },
    active: { type: Boolean, default: true },
    /** Closed / won pipeline end (e.g. Delivered). */
    isTerminal: { type: Boolean, default: false },
    /** Lost / not interested style stage. */
    isLost: { type: Boolean, default: false },
    /** Cannot delete; rename/reorder/deactivate restricted carefully. */
    systemProtected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

leadStageSchema.index({ order: 1 });
leadStageSchema.index({ active: 1, order: 1 });

module.exports = mongoose.model('LeadStage', leadStageSchema);
