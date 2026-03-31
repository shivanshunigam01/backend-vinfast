const mongoose = require('mongoose');

const TestDriveSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  customerName: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  model: { type: String, enum: ['VF 6', 'VF 7'], required: true },
  preferredDate: { type: Date, required: true },
  preferredTime: { type: String, required: true, trim: true },
  branch: { type: String, default: 'Patna Showroom' },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'], default: 'Pending' },
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  feedback: { type: String, trim: true },
  feedbackRating: { type: Number, min: 1, max: 5 }
}, { timestamps: true });

module.exports = mongoose.model('TestDrive', TestDriveSchema);
