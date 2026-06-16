const asyncHandler = require('../utils/asyncHandler');
const { buildLeadAdminReport } = require('../utils/leadReportBuilder');

/** GET /admin/td/leads/reports/admin — full lead CRM report for managers */
exports.getAdminReport = asyncHandler(async (req, res) => {
  const data = await buildLeadAdminReport({
    from: req.query.from,
    to: req.query.to,
    executiveId: req.query.executiveId
  });
  res.json({ success: true, data });
});
