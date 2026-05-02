const mongoose = require('mongoose');
const {
  testDriveStatuses,
  productModels,
  testDrivePreferredLocations,
  yesNo,
  purchaseTimelines,
} = require('../constants/enums');

const testDriveSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    model: { type: String, enum: productModels.filter((v) => v !== 'Both'), required: true },
    city: { type: String, trim: true },
    preferredDate: { type: Date, required: true },
    preferredTime: { type: String, trim: true },
    branch: { type: String, trim: true },
    preferredTestDriveLocation: {
      type: String,
      enum: testDrivePreferredLocations,
      trim: true,
    },
    ownsCar: { type: String, enum: yesNo, trim: true },
    currentCarDetails: { type: String, trim: true },
    purchaseTimeline: { type: String, enum: purchaseTimelines, trim: true },
    remarks: { type: String, trim: true },
    status: { type: String, enum: testDriveStatuses, default: 'Pending' },
    assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    feedback: { type: String, trim: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    utmSource: String,
    pageSource: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestDrive', testDriveSchema);
