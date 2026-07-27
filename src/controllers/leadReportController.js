const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildLeadAdminReport } = require('../utils/leadReportBuilder');
const { buildExecutiveDashboard } = require('../utils/executiveDashboardBuilder');
const { buildCreReport } = require('../utils/creReportBuilder');
const { isCrmStaffRole } = require('../constants/leadStages');
const { isCreUser } = require('../utils/leadAssignment');

exports.getAdminReport = asyncHandler(async (req, res) => {
  const data = await buildLeadAdminReport({
    from: req.query.from,
    to: req.query.to,
    executiveId: req.query.executiveId,
  });
  return successResponse(res, data);
});

exports.getExecutiveDashboard = asyncHandler(async (req, res) => {
  if (!isCrmStaffRole(req.admin.role) && !isCreUser(req.admin)) {
    throw new ApiError(403, 'Executive dashboard is for CRM staff only');
  }

  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

  // CRE "My Dashboard" is their individual creator/assignment report — not assignee scope.
  if (isCreUser(req.admin)) {
    const data = await buildCreReport({ creId: req.admin._id, year });
    return successResponse(res, { ...data, reportType: 'cre' });
  }

  const data = await buildExecutiveDashboard({
    executiveId: req.admin._id,
    year,
  });
  return successResponse(res, { ...data, reportType: 'executive' });
});

/** Manager/admin can open any CRE's individual report via ?creId= */
exports.getCreReport = asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  let creId = req.query.creId;

  if (isCreUser(req.admin)) {
    creId = req.admin._id;
  } else if (!['manager', 'superadmin'].includes(req.admin.role) && !isCreUser(req.admin)) {
    throw new ApiError(403, 'CRE reports are for CRE users and managers');
  }

  if (!creId) throw new ApiError(400, 'creId is required');
  const data = await buildCreReport({ creId, year });
  return successResponse(res, { ...data, reportType: 'cre' });
});
