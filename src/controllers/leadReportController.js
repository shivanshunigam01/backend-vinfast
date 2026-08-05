const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildLeadAdminReport } = require('../utils/leadReportBuilder');
const {
  buildExecutiveDashboard,
  buildManagerTeamDashboard,
  isManagerDashboardUser,
} = require('../utils/executiveDashboardBuilder');
const { buildDeliveryReport } = require('../utils/deliveryReportBuilder');
const { buildCreReport } = require('../utils/creReportBuilder');
const { isCrmStaffRole } = require('../constants/leadStages');
const { isCreUser } = require('../utils/leadAssignment');

function readPeriodQuery(req) {
  return {
    period: req.query.period,
    from: req.query.from,
    to: req.query.to,
    year: req.query.year ? Number(req.query.year) : undefined,
  };
}

exports.getAdminReport = asyncHandler(async (req, res) => {
  const data = await buildLeadAdminReport({
    from: req.query.from,
    to: req.query.to,
    executiveId: req.query.executiveId,
  });
  return successResponse(res, data);
});

exports.getDeliveryReport = asyncHandler(async (req, res) => {
  const data = await buildDeliveryReport(readPeriodQuery(req));
  return successResponse(res, data);
});

exports.getExecutiveDashboard = asyncHandler(async (req, res) => {
  if (!isCrmStaffRole(req.admin.role) && !isCreUser(req.admin)) {
    throw new ApiError(403, 'Executive dashboard is for CRM staff only');
  }

  const periodQuery = readPeriodQuery(req);
  const year = periodQuery.year || new Date().getFullYear();

  // CRE "My Dashboard" is their individual creator/assignment report — not assignee scope.
  if (isCreUser(req.admin)) {
    const data = await buildCreReport({ creId: req.admin._id, ...periodQuery, year });
    return successResponse(res, { ...data, reportType: 'cre' });
  }

  // Sales Manager / Sales Head / Branch Manager — own + team metrics.
  if (isManagerDashboardUser(req.admin)) {
    const data = await buildManagerTeamDashboard({ admin: req.admin, ...periodQuery, year });
    return successResponse(res, data);
  }

  const data = await buildExecutiveDashboard({
    executiveId: req.admin._id,
    ...periodQuery,
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
  const data = await buildCreReport({ creId, ...readPeriodQuery(req), year });
  return successResponse(res, { ...data, reportType: 'cre' });
});
