const mongoose = require('mongoose');

const vehicleAllocationSchema = new mongoose.Schema(
  {
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleOrder', index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    vin: { type: String, required: true, trim: true, uppercase: true },
    customerName: { type: String, trim: true },
    bookingNo: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'RELEASED', 'EXPIRED', 'BOOKED'], default: 'ACTIVE', index: true },
    allocatedAt: { type: Date, default: Date.now },
    reservationExpiry: { type: Date },
    releasedAt: { type: Date },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleAllocation', vehicleAllocationSchema);
