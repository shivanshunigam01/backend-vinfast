const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  managerName: { type: String, trim: true },
  active: { type: Boolean, default: true },
  tdSlotDuration: { type: Number, default: 45, min: 30, max: 60 }, // minutes
  tdBufferTime: { type: Number, default: 15, min: 0, max: 30 },     // minutes between slots
  tdStartTime: { type: String, default: '09:00' },
  tdEndTime: { type: String, default: '18:00' },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  }
}, { timestamps: true });

module.exports = mongoose.model('Branch', BranchSchema);
