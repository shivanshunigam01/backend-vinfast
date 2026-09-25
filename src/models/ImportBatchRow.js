const mongoose = require('mongoose');

const importErrorSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true },
    field: { type: String, trim: true },
    message: { type: String, trim: true },
  },
  { _id: false },
);

const importBatchRowSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', required: true, index: true },
    rowNumber: { type: Number, required: true },
    rawData: { type: mongoose.Schema.Types.Mixed },
    parsedData: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['valid', 'error', 'corrected', 'committed', 'skipped'],
      default: 'valid',
      index: true,
    },
    issues: [importErrorSchema],
    corrections: { type: mongoose.Schema.Types.Mixed, default: {} },
    leadId: { type: String, trim: true },
    message: { type: String, trim: true },
  },
  { timestamps: true },
);

importBatchRowSchema.index({ batchId: 1, rowNumber: 1 }, { unique: true });

module.exports = mongoose.model('ImportBatchRow', importBatchRowSchema);
