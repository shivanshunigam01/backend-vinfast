const router = require('express').Router();
const ctrl = require('../../controllers/leadCrmController');
const reportCtrl = require('../../controllers/leadReportController');
const { authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { crmCreateLeadValidator } = require('../../validators/adminValidators');
const { requireModuleAction, requireModuleActionOrRoles, canPerformAction } = require('../../utils/modulePermissions');
const { isCreOrCrmDeskUser } = require('../../constants/creAccess');
const ApiError = require('../../utils/apiError');
const uploadCrmLeadImport = require('../../middleware/uploadCrmLeadImport');
const importBatchCtrl = require('../../controllers/importBatchController');

function withModuleView(view) {
  return (req, _res, next) => {
    req.query.moduleView = req.query.moduleView || view;
    next();
  };
}

function requireCrmLeadExport(req, _res, next) {
  const user = req.admin;
  if (!user) return next(new ApiError(401, 'Not authenticated'));
  if (isCreOrCrmDeskUser(user) || canPerformAction(user, 'crm_leads', 'export')) return next();
  return next(new ApiError(403, 'You do not have permission to download this report'));
}

router.use(withModuleView('crm'));

router.get('/meta/stages', ctrl.getCrmStages);
router.get('/meta/sources', ctrl.getCrmSources);
router.get('/meta/executives', ctrl.listCrmExecutives);
router.get('/stats', requireModuleAction('crm_leads', 'view'), ctrl.getCrmLeadStats);
router.get('/action-centre', requireModuleAction('crm_leads', 'view'), ctrl.getActionCentre);
router.get('/reports/admin', reportCtrl.requireLeadAdminReportAccess, reportCtrl.getAdminReport);
router.get('/reports/me', reportCtrl.getExecutiveDashboard);
router.get('/reports/cre', reportCtrl.getCreReport);
router.get('/duplicates/opportunities', authorize('superadmin', 'manager'), ctrl.checkOpportunityDuplicates);

router.get('/export', requireCrmLeadExport, ctrl.exportCrmLeads);
router.get(
  '/follow-ups/by-customer',
  requireModuleAction('crm_leads', 'view'),
  ctrl.getCustomerFollowUps,
);
router.post(
  '/import',
  requireModuleAction('crm_leads', 'create'),
  (req, res, next) => {
    // Multipart file optional — JSON body { leads, followUps } also supported.
    if (req.is('multipart/form-data')) {
      return uploadCrmLeadImport(req, res, next);
    }
    return next();
  },
  ctrl.importCrmLeads,
);
router.post(
  '/import/preview',
  requireModuleAction('crm_import_review', 'create'),
  uploadCrmLeadImport,
  importBatchCtrl.previewImportBatch,
);
router.get(
  '/import/batches',
  requireModuleAction('crm_import_review', 'view'),
  importBatchCtrl.listImportBatches,
);
router.get(
  '/import/batches/:id',
  requireModuleAction('crm_import_review', 'view'),
  importBatchCtrl.getImportBatch,
);
router.patch(
  '/import/batches/:batchId/rows/:rowNumber',
  requireModuleAction('crm_import_review', 'update'),
  importBatchCtrl.updateImportBatchRow,
);
router.post(
  '/import/batches/:id/commit',
  requireModuleAction('crm_import_review', 'create'),
  importBatchCtrl.commitImportBatch,
);
router.post(
  '/import/batches/:id/cancel',
  requireModuleAction('crm_import_review', 'update'),
  importBatchCtrl.cancelImportBatch,
);
router.post(
  '/bulk-delete',
  requireModuleActionOrRoles('crm_leads', 'delete', 'superadmin', 'manager'),
  ctrl.bulkDeleteCrmLeads,
);

router.get('/', requireModuleAction('crm_leads', 'view'), ctrl.getCrmLeads);
router.post(
  '/',
  requireModuleAction('crm_leads', 'create'),
  crmCreateLeadValidator,
  validate,
  ctrl.createCrmLead,
);
router.post('/bulk', requireModuleAction('crm_leads', 'create'), ctrl.bulkCreateCrmLeads);
router.get('/:id', requireModuleAction('crm_leads', 'view'), ctrl.getCrmLeadDetail);
router.get('/:id/test-drives', requireModuleAction('crm_leads', 'view'), ctrl.getLeadTestDrives);
router.post('/:id/test-drive', requireModuleAction('crm_leads', 'update'), ctrl.bookTestDriveForLead);
router.post('/:id/convert', requireModuleAction('crm_leads', 'update'), ctrl.convertLeadToSale);
router.post('/:id/reopen', requireModuleAction('crm_leads', 'update'), ctrl.reopenLostLead);
router.patch(
  '/:id/assign',
  requireModuleActionOrRoles('crm_leads', 'assign', 'superadmin', 'manager'),
  ctrl.assignLeadExecutive,
);
router.patch('/:id/details', requireModuleAction('crm_leads', 'update'), ctrl.updateLeadDetails);
router.patch('/:id/cre-sheet', requireModuleAction('crm_leads', 'update'), ctrl.updateLeadCreSheet);
router.patch('/:id/stage', requireModuleAction('crm_leads', 'update'), ctrl.updateLeadStage);
router.patch('/:id/remarks', requireModuleAction('crm_leads', 'update'), ctrl.updateLeadRemarks);
router.patch('/:id/favourite', requireModuleAction('crm_leads', 'update'), ctrl.toggleFavourite);
router.get('/:id/follow-ups', requireModuleAction('crm_leads', 'view'), ctrl.listLeadFollowUps);
router.post('/:id/follow-ups', requireModuleAction('crm_leads', 'update'), ctrl.addFollowUp);
router.patch('/:id/follow-ups/:followUpId', requireModuleAction('crm_leads', 'update'), ctrl.updateFollowUp);
router.delete(
  '/:id',
  requireModuleActionOrRoles('crm_leads', 'delete', 'superadmin', 'manager'),
  ctrl.deleteCrmLead,
);

module.exports = router;
