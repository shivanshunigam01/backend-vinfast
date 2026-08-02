const router = require('express').Router();
const ctrl = require('../../controllers/pricingController');
const { requireModuleAction } = require('../../utils/modulePermissions');

router.get('/', requireModuleAction('pricing', 'view'), ctrl.listAdmin);
router.get('/:slug', requireModuleAction('pricing', 'view'), ctrl.getOne);
router.put('/:slug', requireModuleAction('pricing', 'update'), ctrl.updateOne);

module.exports = router;
