const router = require('express').Router();
const ctrl = require('../../controllers/leadCrmController');
const { requireModuleAction, requireModuleActionOrRoles } = require('../../utils/modulePermissions');
const { crmCreateLeadValidator } = require('../../validators/adminValidators');
const validate = require('../../middleware/validate');

function withModuleView(view) {
  return (req, _res, next) => {
    req.query.moduleView = req.query.moduleView || view;
    next();
  };
}

router.use(withModuleView('booking'));

router.get('/meta/stages', ctrl.getCrmStages);
router.get('/meta/executives', ctrl.listCrmExecutives);
router.get('/stats', requireModuleAction('crm_booking_leads', 'view'), ctrl.getCrmLeadStats);
router.get('/', requireModuleAction('crm_booking_leads', 'view'), ctrl.getCrmLeads);
router.get('/:id', requireModuleAction('crm_booking_leads', 'view'), ctrl.getCrmLeadDetail);
router.patch('/:id/cre-sheet', requireModuleAction('crm_booking_leads', 'update'), ctrl.updateLeadCreSheet);
router.patch('/:id/stage', requireModuleAction('crm_booking_leads', 'update'), ctrl.updateLeadStage);
router.patch('/:id/remarks', requireModuleAction('crm_booking_leads', 'update'), ctrl.updateLeadRemarks);
router.patch(
  '/:id/assign',
  requireModuleActionOrRoles('crm_booking_leads', 'assign', 'superadmin', 'manager'),
  ctrl.assignLeadExecutive,
);

module.exports = router;
