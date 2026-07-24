const mongoose = require('mongoose');

const RATING_FIELDS = [
  'designComfort',
  'rideQuietness',
  'performanceHandling',
  'featuresTechnology',
  'productGuidance',
  'consultantExperience',
  'overallTestDrive',
  'recommend',
];

const rating = { type: Number, required: true, min: 1, max: 5 };

const testDriveFeedbackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    model: { type: String, trim: true },
    testDriveDate: { type: Date },
    salesConsultant: { type: String, trim: true },
    leadSource: { type: String, trim: true, default: 'Digital' },
    purchaseIntent: { type: String, required: true, trim: true },
    mainConcern: { type: String, trim: true, default: 'None' },
    /** Brochure-style product highlights the customer liked (multi-select). */
    likedFeatures: { type: [String], default: [] },
    /** Free-text: what they did not like about the product. */
    dislikedAboutProduct: { type: String, trim: true },
    /** Free-text: suggestions / feedback for Patliputra VinFast. */
    dealerSuggestions: { type: String, trim: true },
    comment: { type: String, trim: true },
    ratings: {
      designComfort: rating,
      rideQuietness: rating,
      performanceHandling: rating,
      featuresTechnology: rating,
      productGuidance: rating,
      consultantExperience: rating,
      overallTestDrive: rating,
      recommend: rating,
    },
    /** Short human-friendly reference shown to the customer after submitting. */
    reference: { type: String, trim: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestDriveFeedback', testDriveFeedbackSchema);
module.exports.RATING_FIELDS = RATING_FIELDS;
