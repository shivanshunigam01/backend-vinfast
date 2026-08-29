const mongoose = require('mongoose');

const vehicleDiagnosticSchema = new mongoose.Schema(
  {
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    pdiId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPdi', index: true },
    vin: { type: String, required: true, trim: true, uppercase: true },
    dtcCode: { type: String, required: true, trim: true },
    dtcSeverity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], default: 'INFO' },
    description: { type: String, trim: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleDiagnostic', vehicleDiagnosticSchema);
