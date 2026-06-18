const mongoose = require('mongoose');

const pvCustomerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, trim: true },
    otherCity: { type: String, trim: true },
    parentCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'PVCustomer', index: true },
    isSubCustomer: { type: Boolean, default: false },
    vehicleRegistration: { type: String, trim: true },
  },
  { timestamps: true },
);

pvCustomerSchema.index({ mobile: 1, isSubCustomer: 1 });

module.exports = mongoose.model('PVCustomer', pvCustomerSchema);
