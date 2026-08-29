const router = require('express').Router();
const ctrl = require('../../controllers/vendorController');
const { mongoIdParam } = require('../../validators/adminValidators');
const validate = require('../../middleware/validate');
const { requireAnyModuleAction } = require('../../utils/modulePermissions');

function mod(action) {
  return requireAnyModuleAction([
    [`stock_vendors`, action],
    ['stock_config', action === 'view' ? 'view' : 'update'],
    ['stock_po', action === 'view' ? 'view' : 'update'],
    ['stock_delivery', action === 'view' ? 'view' : 'update'],
  ]);
}

router.get('/', mod('view'), ctrl.listVendors);
router.post('/', requireAnyModuleAction([['stock_vendors', 'create'], ['stock_config', 'update']]), ctrl.createVendor);
router.get('/:id', mongoIdParam, validate, mod('view'), ctrl.getVendor);
router.put('/:id', mongoIdParam, validate, requireAnyModuleAction([['stock_vendors', 'update'], ['stock_config', 'update']]), ctrl.updateVendor);
router.delete('/:id', mongoIdParam, validate, requireAnyModuleAction([['stock_vendors', 'delete'], ['stock_config', 'update']]), ctrl.deleteVendor);

module.exports = router;
