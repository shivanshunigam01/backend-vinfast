const TDFeedback = require('../models/TDFeedback');
const TDBooking = require('../models/TDBooking');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

// POST /td/feedback — customer submits feedback
exports.submitFeedback = asyncHandler(async (req, res) => {
  const { bookingId, overallRating, vehicleRating, executiveRating, processRating,
    likedMost, improvements, wouldRecommend, interestedToBuy, preferredModel,
    budgetRange, npsScore, comments, feedbackChannel } = req.body;

  if (!bookingId) throw new ApiError(400, 'bookingId is required');
  if (!overallRating) throw new ApiError(400, 'overallRating is required');

  const booking = await TDBooking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== 'Completed') throw new ApiError(400, 'Feedback can only be submitted after test drive completion');

  const existing = await TDFeedback.findOne({ booking: bookingId });
  if (existing) return res.json({ success: true, message: 'Feedback already submitted', data: existing });

  const feedback = await TDFeedback.create({
    booking: bookingId,
    customer: booking.customer,
    vehicle: booking.assignedVehicle,
    overallRating, vehicleRating, executiveRating, processRating,
    likedMost, improvements, wouldRecommend, interestedToBuy, preferredModel,
    budgetRange, npsScore, comments,
    feedbackChannel: feedbackChannel || 'In-person'
  });

  res.status(201).json({ success: true, message: 'Thank you for your feedback!', data: feedback });
});

// GET /admin/td/feedback — admin views all feedback
exports.getAllFeedback = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.query.minRating) query.overallRating = { $gte: Number(req.query.minRating) };
  if (req.query.interestedToBuy !== undefined) query.interestedToBuy = req.query.interestedToBuy === 'true';

  const [docs, total] = await Promise.all([
    TDFeedback.find(query)
      .populate('customer', 'name mobile customerId')
      .populate('vehicle', 'vehicleId model')
      .populate('booking', 'bookingRef preferredDate')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    TDFeedback.countDocuments(query)
  ]);
  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

// GET /admin/td/feedback/stats — aggregated feedback stats
exports.getFeedbackStats = asyncHandler(async (req, res) => {
  const [stats] = await TDFeedback.aggregate([
    {
      $group: {
        _id: null,
        totalFeedbacks: { $sum: 1 },
        avgOverall: { $avg: '$overallRating' },
        avgVehicle: { $avg: '$vehicleRating' },
        avgExecutive: { $avg: '$executiveRating' },
        avgProcess: { $avg: '$processRating' },
        avgNps: { $avg: '$npsScore' },
        interestedCount: { $sum: { $cond: ['$interestedToBuy', 1, 0] } },
        wouldRecommendCount: { $sum: { $cond: ['$wouldRecommend', 1, 0] } },
        vf6Preference: { $sum: { $cond: [{ $eq: ['$preferredModel', 'VF 6'] }, 1, 0] } },
        vf7Preference: { $sum: { $cond: [{ $eq: ['$preferredModel', 'VF 7'] }, 1, 0] } }
      }
    }
  ]);

  res.json({ success: true, data: stats || {} });
});
