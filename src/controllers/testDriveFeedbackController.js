const TestDriveFeedback = require('../models/TestDriveFeedback');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { applyExecutiveFeedbackScope } = require('../utils/feedbackScope');

const MSG_FEEDBACK_OK = 'Thank you! Your test-drive feedback has been submitted to Patliputra VinFast.';

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.createTestDriveFeedback = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const doc = await TestDriveFeedback.create({
    name: body.name,
    mobile: body.mobile,
    city: body.city,
    model: body.model,
    testDriveDate: body.testDriveDate || undefined,
    salesConsultant: body.salesConsultant,
    leadSource: body.leadSource,
    purchaseIntent: body.purchaseIntent,
    mainConcern: body.mainConcern,
    likedFeatures: Array.isArray(body.likedFeatures)
      ? body.likedFeatures.map((v) => String(v).trim()).filter(Boolean)
      : [],
    dislikedAboutProduct: body.dislikedAboutProduct,
    dealerSuggestions: body.dealerSuggestions,
    comment: body.comment,
    ratings: body.ratings,
  });

  doc.reference = `TDF-${String(doc._id).slice(-6).toUpperCase()}`;
  await doc.save();

  return successResponse(
    res,
    { id: doc._id, reference: doc.reference },
    MSG_FEEDBACK_OK,
    201
  );
});

/** Admin: paginated list of test-drive feedback submissions with rating averages. */
exports.listTestDriveFeedback = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);

  const query = {};
  const search = String(req.query.search || '').trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ name: rx }, { mobile: rx }, { reference: rx }, { model: rx }, { salesConsultant: rx }];
  }
  if (req.query.model && req.query.model !== 'all') {
    query.model = String(req.query.model).trim();
  }
  if (req.query.purchaseIntent && req.query.purchaseIntent !== 'all') {
    query.purchaseIntent = String(req.query.purchaseIntent).trim();
  }

  await applyExecutiveFeedbackScope(req.admin, query, { matchConsultant: true });

  const [docs, total, stats] = await Promise.all([
    TestDriveFeedback.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    TestDriveFeedback.countDocuments(query),
    TestDriveFeedback.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgOverall: { $avg: '$ratings.overallTestDrive' },
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
exports.deleteTestDriveFeedback = asyncHandler(async (req, res) => {
  const doc = await TestDriveFeedback.findByIdAndDelete(req.params.id);
  if (!doc) throw new ApiError(404, 'Feedback entry not found');
  return successResponse(res, { _id: doc._id }, 'Feedback entry deleted');
});
