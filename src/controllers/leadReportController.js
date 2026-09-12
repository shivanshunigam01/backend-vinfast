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
const { buildBookingReport } = require('../utils/bookingReportBuilder');
const { buildDetailedReport } = require('../utils/detailedReportBuilder');
const { buildCreReport } = require('../utils/creReportBuilder');
const { isCrmStaffRole } = require('../constants/leadStages');
const { isCreUser, isCrmDeskUser } = require('../utils/leadAssignment');
const { isCreOrCrmDeskUser } = require('../constants/creAccess');
const { canPerformAction } = require('../utils/modulePermissions');

function readPeriodQuery(req) {
  return {
    period: req.query.period,
    from: req.query.from,
    to: req.query.to,
    year: req.query.year ? Number(req.query.year) : undefined,
  };
}

function readLeadFilterQuery(req) {
  return {
    status: req.query.status || req.query.stage || undefined,
    source: req.query.source || undefined,
    model: req.query.model || undefined,
    buyerType: req.query.buyerType || undefined,
    channel: req.query.channel || undefined,
    designation: req.query.designation || req.query.role || undefined,
  };
}

function canViewLeadAdminReport(admin) {
  if (!admin) return false;
  if (admin.userType === 'admin' || admin.role === 'superadmin') return true;
  if (isCreOrCrmDeskUser(admin) || isCreUser(admin) || isCrmDeskUser(admin)) return true;
  if (canPerformAction(admin, 'td_lead_reports', 'view')) return true;
  if (['manager', 'superadmin'].includes(admin.role)) return true;
  return false;
}

/** Express middleware — CRE / CRM desk + anyone with Lead Reports view. */
exports.requireLeadAdminReportAccess = (req, _res, next) => {
  if (!req.admin) return next(new ApiError(401, 'Not authenticated'));
  if (!canViewLeadAdminReport(req.admin)) {
    return next(new ApiError(403, 'You do not have permission to view or download lead reports'));
  }
  return next();
};

exports.getAdminReport = asyncHandler(async (req, res) => {
  if (!canViewLeadAdminReport(req.admin)) {
    throw new ApiError(403, 'You do not have permission to view or download lead reports');
  }
  const data = await buildLeadAdminReport({
    from: req.query.from,
    to: req.query.to,
    executiveId: req.query.executiveId,
    ...readLeadFilterQuery(req),
  });
  return successResponse(res, data);
});

exports.getDeliveryReport = asyncHandler(async (req, res) => {
  const data = await buildDeliveryReport({
    ...readPeriodQuery(req),
    source: req.query.source || undefined,
  });
  return successResponse(res, data);
});

exports.getBookingReport = asyncHandler(async (req, res) => {
  const data = await buildBookingReport({
    ...readPeriodQuery(req),
    source: req.query.source || undefined,
  });
  return successResponse(res, data);
});

exports.getDetailedReport = asyncHandler(async (req, res) => {
  const data = await buildDetailedReport({ admin: req.admin });
  return successResponse(res, data);
});

exports.getExecutiveDashboard = asyncHandler(async (req, res) => {
  if (!isCrmStaffRole(req.admin.role) && !isCreUser(req.admin) && !isCrmDeskUser(req.admin)) {
    throw new ApiError(403, 'Executive dashboard is for CRM staff only');
  }

  const periodQuery = readPeriodQuery(req);
  const leadFilters = readLeadFilterQuery(req);
  const year = periodQuery.year || new Date().getFullYear();

  // CRE "My Dashboard" is their individual creator/assignment report — not assignee scope.
  if (isCreUser(req.admin)) {
    const data = await buildCreReport({ creId: req.admin._id, ...periodQuery, year, ...leadFilters });
    return successResponse(res, { ...data, reportType: 'cre' });
  }

  // Sales Manager / Sales Head / Branch Manager — own + team metrics.
  if (isManagerDashboardUser(req.admin)) {
    const data = await buildManagerTeamDashboard({ admin: req.admin, ...periodQuery, year, ...leadFilters });
    return successResponse(res, data);
  }

  const data = await buildExecutiveDashboard({
    executiveId: req.admin._id,
    ...periodQuery,
    year,
    ...leadFilters,
  });
  return successResponse(res, { ...data, reportType: 'executive' });
});

/** Manager/admin can open any CRE's individual report via ?creId= */
exports.getCreReport = asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  let creId = req.query.creId;

  if (isCreUser(req.admin)) {
    creId = req.admin._id;
  } else if (
    !['manager', 'superadmin'].includes(req.admin.role) &&
    !isCreUser(req.admin) &&
    !isCrmDeskUser(req.admin)
  ) {
    throw new ApiError(403, 'CRE reports are for CRE users, CRM desk, and managers');
  }

  if (!creId) throw new ApiError(400, 'creId is required');
  const data = await buildCreReport({
    creId,
    ...readPeriodQuery(req),
    year,
    ...readLeadFilterQuery(req),
  });
  return successResponse(res, { ...data, reportType: 'cre' });
});
