const mongoose = require('mongoose');

const metaLeadSchema = new mongoose.Schema(
  {
    uniqueId: { type: String, trim: true, index: true, sparse: true },
    webhookNamespace: { type: String, trim: true },
    method: { type: String, trim: true },
    url: { type: String, trim: true },
    headers: { type: mongoose.Schema.Types.Mixed },
    rawPayload: { type: mongoose.Schema.Types.Mixed, required: true },
    rawBody: { type: mongoose.Schema.Types.Mixed },

    // Normalized fields for UI filters/table
    name: { type: String, trim: true },
    mobile: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    state: { type: String, trim: true },
    pin: { type: String, trim: true },
    interestedModel: { type: String, trim: true },
    existingVehicle: { type: String, trim: true },
    flowToken: { type: mongoose.Schema.Types.Mixed },
    receivedAt: { type: Date },

    // Linked CRM lead (stored in Lead collection)
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MetaLead', metaLeadSchema);

