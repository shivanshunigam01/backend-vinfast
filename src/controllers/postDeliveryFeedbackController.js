const PostDeliveryFeedback = require('../models/PostDeliveryFeedback');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { applyExecutiveFeedbackScope } = require('../utils/feedbackScope');

const MSG_FEEDBACK_OK = 'Thank you! Your feedback has been submitted to Patliputra VinFast.';

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.createPostDeliveryFeedback = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const doc = await PostDeliveryFeedback.create({
    name: body.name,
    mobile: body.mobile,
    model: body.model,
    colour: body.colour,
    deliveryDate: body.deliveryDate || undefined,
    leadSource: body.leadSource,
    comment: body.comment,
    ratings: body.ratings,
  });

  doc.reference = `FB-${String(doc._id).slice(-6).toUpperCase()}`;
  await doc.save();

  return successResponse(
    res,
    { id: doc._id, reference: doc.reference },
    MSG_FEEDBACK_OK,
    201
  );
});

/** Admin: paginated list of post-delivery feedback submissions with rating averages. */
exports.listPostDeliveryFeedback = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);

  const query = {};
  const search = String(req.query.search || '').trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ name: rx }, { mobile: rx }, { reference: rx }, { model: rx }];
  }
  if (req.query.model && req.query.model !== 'all') {
    query.model = String(req.query.model).trim();
  }

  // Post-delivery forms have no salesConsultant — scope by assigned-lead mobiles only.
  await applyExecutiveFeedbackScope(req.admin, query, { matchConsultant: false });

  const [docs, total, stats] = await Promise.all([
    PostDeliveryFeedback.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PostDeliveryFeedback.countDocuments(query),
    PostDeliveryFeedback.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgOverall: { $avg: '$ratings.overallJourney' },
          avgRecommend: { $avg: '$ratings.recommend' },
        },
      },
    ]),
  ]);

  const summary = stats[0] || { count: 0, avgOverall: null, avgRecommend: null };
  return successResponse(res, docs, undefined, 200, {
    page,
    limit,
    total,
    summary: {
      total: summary.count,
      avgOverall: summary.avgOverall ? Number(summary.avgOverall.toFixed(2)) : null,
      avgRecommend: summary.avgRecommend ? Number(summary.avgRecommend.toFixed(2)) : null,
    },
  });
});

/** Admin: remove a junk/test submission. */
exports.deletePostDeliveryFeedback = asyncHandler(async (req, res) => {
  const doc = await PostDeliveryFeedback.findByIdAndDelete(req.params.id);
  if (!doc) throw new ApiError(404, 'Feedback entry not found');
  return successResponse(res, { _id: doc._id }, 'Feedback entry deleted');
});
