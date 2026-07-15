const mongoose = require('mongoose');

const RATING_FIELDS = [
  'firstResponse',
  'consultation',
  'testDrive',
  'booking',
  'deliveryReadiness',
  'handover',
  'overallJourney',
  'recommend',
];

const rating = { type: Number, required: true, min: 1, max: 5 };

const postDeliveryFeedbackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
    colour: { type: String, trim: true },
    deliveryDate: { type: Date },
    leadSource: { type: String, trim: true, default: 'Digital' },
    comment: { type: String, trim: true },
    ratings: {
      firstResponse: rating,
      consultation: rating,
      testDrive: rating,
      booking: rating,
      deliveryReadiness: rating,
      handover: rating,
      overallJourney: rating,
      recommend: rating,
    },
    /** Short human-friendly reference shown to the customer after submitting. */
    reference: { type: String, trim: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PostDeliveryFeedback', postDeliveryFeedbackSchema);
module.exports.RATING_FIELDS = RATING_FIELDS;
