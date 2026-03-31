const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  city: { type: String, trim: true },
  model: { type: String, trim: true },
  message: { type: String, trim: true },
  type: { type: String, enum: ['General', 'Price', 'Finance', 'Service', 'Complaint', 'Other'], default: 'General' },
  status: { type: String, enum: ['Open', 'Responded', 'Closed'], default: 'Open' },
  source: { type: String, default: 'Contact Form' }
}, { timestamps: true });

module.exports = mongoose.model('Enquiry', EnquirySchema);
