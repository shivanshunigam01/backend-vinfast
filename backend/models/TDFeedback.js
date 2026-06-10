const mongoose = require('mongoose');

const TDFeedbackSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking', required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle' },

  overallRating: { type: Number, required: true, min: 1, max: 5 },
  vehicleRating: { type: Number, min: 1, max: 5 },
  executiveRating: { type: Number, min: 1, max: 5 },
  processRating: { type: Number, min: 1, max: 5 },

  likedMost: { type: String, trim: true },
  improvements: { type: String, trim: true },
  wouldRecommend: { type: Boolean },
  interestedToBuy: { type: Boolean },
  preferredModel: { type: String, enum: ['VF 6', 'VF 7', 'Both', 'Undecided'] },
  budgetRange: { type: String },

  npsScore: { type: Number, min: 0, max: 10 },
  comments: { type: String, trim: true },

  submittedAt: { type: Date, default: Date.now },
  feedbackChannel: { type: String, enum: ['In-person', 'WhatsApp', 'SMS Link', 'Email Link', 'App'], default: 'In-person' }
}, { timestamps: true });

module.exports = mongoose.model('TDFeedback', TDFeedbackSchema);
