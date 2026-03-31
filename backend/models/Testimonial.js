const mongoose = require('mongoose');

const TestimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String },
  model: { type: String },
  rating: { type: Number, min: 1, max: 5 },
  text: { type: String },
  photo: { type: String },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', TestimonialSchema);
