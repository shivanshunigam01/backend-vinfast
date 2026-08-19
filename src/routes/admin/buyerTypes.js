const router = require('express').Router();
const ctrl = require('../../controllers/buyerTypeController');
const { requireModuleAction, requireAnyModuleAction } = require('../../utils/modulePermissions');

router.get(
  '/',
  requireAnyModuleAction([
    ['crm_leads', 'view'],
    ['crm_buyer_types', 'view'],
  ]),
  ctrl.listBuyerTypes,
);
router.post('/', requireModuleAction('crm_buyer_types', 'create'), ctrl.createBuyerType);
router.put('/reorder', requireModuleAction('crm_buyer_types', 'update'), ctrl.reorderBuyerTypes);
router.put('/:id', requireModuleAction('crm_buyer_types', 'update'), ctrl.updateBuyerType);
router.delete('/:id', requireModuleAction('crm_buyer_types', 'delete'), ctrl.deleteBuyerType);

module.exports = router;
