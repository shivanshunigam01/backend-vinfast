const TDFeedback = require('../models/TDFeedback');
const TDBooking = require('../models/TDBooking');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');
const { syncLeadFromTDFeedback } = require('../utils/tdFeedbackToLead');

exports.submitFeedback = asyncHandler(async (req, res) => {
  const { bookingId, customerId, drivingExperience, vehicleComfort, batteryConfidence, executiveBehaviour, purchaseIntention, preferredVariant, remarks } = req.body;

  const booking = await TDBooking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const existing = await TDFeedback.findOne({ bookingId });
  if (existing) {
    const lead = await syncLeadFromTDFeedback({
      bookingId,
      feedback: existing,
      changedBy: req.admin?._id
    });
    return res.json({
      success: true,
      data: existing,
      leadId: lead?._id,
      message: 'Feedback already submitted — lead synced to CRM'
    });
  }

  const feedback = await TDFeedback.create({
    bookingId,
    customerId: customerId || booking.customerId,
    drivingExperience,
    vehicleComfort,
    batteryConfidence,
    executiveBehaviour,
    purchaseIntention,
    preferredVariant,
    remarks
  });

  const lead = await syncLeadFromTDFeedback({
    bookingId,
    feedback,
    changedBy: req.admin?._id
  });

  res.status(201).json({
    success: true,
    data: feedback,
    leadId: lead?._id,
    message: lead
      ? 'Thank you! Customer feedback saved and added to Leads.'
      : 'Thank you for your feedback!'
  });
});

exports.getFeedbacks = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.query.bookingId) query.bookingId = req.query.bookingId;
  if (req.query.customerId) query.customerId = req.query.customerId;
  if (req.query.minRating) query.overallRating = { $gte: Number(req.query.minRating) };

  const [docs, total] = await Promise.all([
    TDFeedback.find(query)
      .populate('bookingId', 'bookingId slotDate')
      .populate('customerId', 'name mobile')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit),
    TDFeedback.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getFeedbackByBooking = asyncHandler(async (req, res) => {
  const feedback = await TDFeedback.findOne({ bookingId: req.params.bookingId })
    .populate('customerId', 'name mobile');
  res.json({ success: true, data: feedback ?? null });
});

exports.getFeedbackStats = asyncHandler(async (req, res) => {
  const stats = await TDFeedback.aggregate([
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgDriving: { $avg: '$drivingExperience' },
        avgComfort: { $avg: '$vehicleComfort' },
        avgBattery: { $avg: '$batteryConfidence' },
        avgExecutive: { $avg: '$executiveBehaviour' },
        avgPurchase: { $avg: '$purchaseIntention' },
        avgOverall: { $avg: '$overallRating' }
      }
    }
  ]);

  const ratingDist = await TDFeedback.aggregate([
    { $group: { _id: '$overallRating', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  res.json({ success: true, data: { ...(stats[0] || {}), ratingDistribution: ratingDist } });
});
