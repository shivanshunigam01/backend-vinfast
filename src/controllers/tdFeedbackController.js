require('../models/tdModels');

const TDFeedback = require('../models/TDFeedback');
const TDBooking = require('../models/TDBooking');
const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');

function avgRating(fields) {
  const vals = fields.filter((n) => typeof n === 'number' && n > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatFeedback(doc) {
  return {
    _id: doc._id,
    bookingId: String(doc.bookingId),
    drivingExperience: doc.drivingExperience,
    vehicleComfort: doc.vehicleComfort,
    batteryConfidence: doc.batteryConfidence,
    executiveBehaviour: doc.executiveBehaviour,
    purchaseIntention: doc.purchaseIntention,
    preferredVariant: doc.preferredVariant,
    remarks: doc.remarks,
    overallRating: doc.overallRating,
  };
}

exports.getByBooking = asyncHandler(async (req, res) => {
  const doc = await TDFeedback.findOne({ bookingId: req.params.bookingId });
  return successResponse(res, doc ? formatFeedback(doc) : null);
});

exports.submitFeedback = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.bookingId) throw new ApiError(400, 'bookingId is required');

  const booking = await TDBooking.findById(body.bookingId).populate('customerId');
  if (!booking) throw new ApiError(404, 'Booking not found');

  const ratings = [
    body.drivingExperience,
    body.vehicleComfort,
    body.batteryConfidence,
    body.executiveBehaviour,
    body.purchaseIntention,
  ].map((n) => Number(n));

  const overallRating = Number(avgRating(ratings).toFixed(1));

  const doc = await TDFeedback.findOneAndUpdate(
    { bookingId: booking._id },
    {
      $set: {
        customerId: body.customerId || booking.customerId?._id || booking.customerId,
        drivingExperience: ratings[0],
        vehicleComfort: ratings[1],
        batteryConfidence: ratings[2],
        executiveBehaviour: ratings[3],
        purchaseIntention: ratings[4],
        preferredVariant: body.preferredVariant,
        remarks: body.remarks,
        overallRating,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  let leadId;
  if (ratings[4] >= 4 && booking.customerId) {
    const customer = booking.customerId;
    const lead = await Lead.create({
      name: customer.name || 'TD Customer',
      mobile: customer.mobile,
      email: customer.email,
      city: customer.city || 'Unknown',
      model: booking.preferredModel || 'VF 7',
      source: 'Test Drive',
      status: 'Interested',
      remarks: `TD feedback — purchase intention ${ratings[4]}/5`,
    });
    leadId = lead._id;
  }

  const message = leadId
    ? 'Thank you! Customer feedback saved and added to Leads.'
    : 'Thank you for your feedback!';

  return res.status(201).json({
    success: true,
    data: formatFeedback(doc),
    leadId: leadId ? String(leadId) : undefined,
    message,
  });
});
