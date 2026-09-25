const mongoose = require('mongoose');

const importBatchSchema = new mongoose.Schema(
  {
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff', required: true, index: true },
    fileName: { type: String, trim: true },
    status: {
      type: String,
      enum: ['review', 'committed', 'cancelled'],
      default: 'review',
      index: true,
    },
    summary: {
      total: { type: Number, default: 0 },
      valid: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
      corrected: { type: Number, default: 0 },
      committed: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    committedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ImportBatch', importBatchSchema);
