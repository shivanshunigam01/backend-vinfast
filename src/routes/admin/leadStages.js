const router = require('express').Router();
const ctrl = require('../../controllers/leadStageController');
const { requireModuleAction } = require('../../utils/modulePermissions');

router.get('/', requireModuleAction('crm_lead_stages', 'view'), ctrl.listStages);
router.post('/', requireModuleAction('crm_lead_stages', 'create'), ctrl.createStage);
router.put('/reorder', requireModuleAction('crm_lead_stages', 'update'), ctrl.reorderStages);
router.put('/:id', requireModuleAction('crm_lead_stages', 'update'), ctrl.updateStage);
router.delete('/:id', requireModuleAction('crm_lead_stages', 'delete'), ctrl.deleteStage);

module.exports = router;
