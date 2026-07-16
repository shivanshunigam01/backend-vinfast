const router = require('express').Router();
const ctrl = require('../../controllers/leadCrmController');
const reportCtrl = require('../../controllers/leadReportController');
const { authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { crmCreateLeadValidator } = require('../../validators/adminValidators');

router.get('/meta/stages', ctrl.getCrmStages);
router.get('/meta/sources', ctrl.getCrmSources);
router.get('/meta/executives', ctrl.listCrmExecutives);
router.get('/reports/admin', authorize('superadmin', 'manager'), reportCtrl.getAdminReport);
router.get('/reports/me', reportCtrl.getExecutiveDashboard);
router.get('/duplicates/opportunities', authorize('superadmin', 'manager'), ctrl.checkOpportunityDuplicates);
router.get('/', ctrl.getCrmLeads);
router.post('/', crmCreateLeadValidator, validate, ctrl.createCrmLead);
router.get('/:id', ctrl.getCrmLeadDetail);
router.get('/:id/test-drives', ctrl.getLeadTestDrives);
router.post('/:id/test-drive', ctrl.bookTestDriveForLead);
router.post('/:id/convert', ctrl.convertLeadToSale);
router.patch('/:id/assign', ctrl.assignLeadExecutive);
router.patch('/:id/details', ctrl.updateLeadDetails);
router.patch('/:id/stage', ctrl.updateLeadStage);
router.patch('/:id/remarks', ctrl.updateLeadRemarks);
router.post('/:id/follow-ups', ctrl.addFollowUp);
router.patch('/:id/follow-ups/:followUpId', ctrl.updateFollowUp);
router.delete('/:id', authorize('superadmin', 'manager'), ctrl.deleteCrmLead);

module.exports = router;
