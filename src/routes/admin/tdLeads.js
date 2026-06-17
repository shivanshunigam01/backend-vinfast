const router = require('express').Router();
const ctrl = require('../../controllers/leadCrmController');
const reportCtrl = require('../../controllers/leadReportController');
const { authorize } = require('../../middleware/auth');

router.get('/meta/stages', ctrl.getCrmStages);
router.get('/meta/executives', ctrl.listCrmExecutives);
router.get('/reports/admin', authorize('superadmin', 'manager'), reportCtrl.getAdminReport);
router.get('/', ctrl.getCrmLeads);
router.get('/:id', ctrl.getCrmLeadDetail);
router.patch('/:id/assign', ctrl.assignLeadExecutive);
router.patch('/:id/stage', ctrl.updateLeadStage);
router.patch('/:id/remarks', ctrl.updateLeadRemarks);
router.post('/:id/follow-ups', ctrl.addFollowUp);
router.patch('/:id/follow-ups/:followUpId', ctrl.updateFollowUp);

module.exports = router;
