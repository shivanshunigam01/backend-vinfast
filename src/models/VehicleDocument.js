const mongoose = require('mongoose');

const vehicleDocumentSchema = new mongoose.Schema(
  {
    vehicleStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleStock', required: true, index: true },
    vin: { type: String, trim: true, uppercase: true },
    docType: { type: String, trim: true },
    label: { type: String, trim: true },
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    entityType: { type: String, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TDStaff' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleDocument', vehicleDocumentSchema);
