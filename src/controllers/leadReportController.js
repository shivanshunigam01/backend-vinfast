const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildLeadAdminReport } = require('../utils/leadReportBuilder');
const { buildExecutiveDashboard } = require('../utils/executiveDashboardBuilder');
const { isCrmStaffRole } = require('../constants/leadStages');

exports.getAdminReport = asyncHandler(async (req, res) => {
  const data = await buildLeadAdminReport({
    from: req.query.from,
    to: req.query.to,
    executiveId: req.query.executiveId,
  });
  return successResponse(res, data);
});

exports.getExecutiveDashboard = asyncHandler(async (req, res) => {
  if (!isCrmStaffRole(req.admin.role)) {
    throw new ApiError(403, 'Executive dashboard is for CRM staff only');
  }

  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const data = await buildExecutiveDashboard({
    executiveId: req.admin._id,
    year,
  });
  return successResponse(res, data);
});
