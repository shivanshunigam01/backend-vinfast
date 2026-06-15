const mongoose = require('mongoose');

const tdCustomerSchema = new mongoose.Schema(
  {
    customerId: { type: String, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TDCustomer', tdCustomerSchema);
