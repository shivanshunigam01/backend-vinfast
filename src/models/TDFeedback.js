const mongoose = require('mongoose');

const tdFeedbackSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking', required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDCustomer' },
    drivingExperience: { type: Number, min: 1, max: 5 },
    vehicleComfort: { type: Number, min: 1, max: 5 },
    batteryConfidence: { type: Number, min: 1, max: 5 },
    executiveBehaviour: { type: Number, min: 1, max: 5 },
    purchaseIntention: { type: Number, min: 1, max: 5 },
    preferredVariant: { type: String, trim: true },
    remarks: { type: String, trim: true },
    overallRating: { type: Number },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TDFeedback', tdFeedbackSchema);
