const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { buildLeadAdminReport } = require('../utils/leadReportBuilder');

exports.getAdminReport = asyncHandler(async (req, res) => {
  const data = await buildLeadAdminReport({
    from: req.query.from,
    to: req.query.to,
    executiveId: req.query.executiveId,
  });
  return successResponse(res, data);
});
