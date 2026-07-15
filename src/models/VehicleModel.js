const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * Master catalog of vehicle models and their variants (trims).
 * Drives the test-drive dropdowns, demo-fleet tagging, and model validation.
 */
const vehicleModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    variants: { type: [variantSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('VehicleModel', vehicleModelSchema);
