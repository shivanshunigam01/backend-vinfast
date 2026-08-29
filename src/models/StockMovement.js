const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    vin: { type: String, required: true, trim: true, uppercase: true },
    fromStatus: { type: String, trim: true },
    toStatus: { type: String, trim: true },
    fromLocation: { type: String, trim: true },
    toLocation: { type: String, trim: true },
    fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBranch' },
    fromYard: { type: String, trim: true },
    toYard: { type: String, trim: true },
    fromZone: { type: String, trim: true },
    toZone: { type: String, trim: true },
    fromBay: { type: String, trim: true },
    toBay: { type: String, trim: true },
    remarks: { type: String, trim: true },
    movedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

stockMovementSchema.index({ vehicleStockId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
