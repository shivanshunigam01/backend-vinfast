const router = require('express').Router();
const validate = require('../../middleware/validate');
const ctrl = require('../../controllers/vehicleStockController');
const { mongoIdParam, vehicleStockValidator } = require('../../validators/adminValidators');
const { requireModuleAction, requireModuleActionOrRoles } = require('../../utils/modulePermissions');

/** Vehicle stock register (/api/v1/admin/stock/vehicles) */
router.get('/', requireModuleAction('vehicle_stock', 'view'), ctrl.listStock);
router.post(
  '/',
  requireModuleActionOrRoles('vehicle_stock', 'create', 'superadmin', 'manager'),
  vehicleStockValidator,
  validate,
  ctrl.createStock,
);
router.get('/:id', mongoIdParam, validate, requireModuleAction('vehicle_stock', 'view'), ctrl.getStock);
router.put(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('vehicle_stock', 'update', 'superadmin', 'manager'),
  ctrl.updateStock,
);
router.patch(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('vehicle_stock', 'update', 'superadmin', 'manager'),
  ctrl.updateStock,
);
router.patch(
  '/:id/demo',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('vehicle_stock', 'tag_demo', 'superadmin', 'manager'),
  ctrl.tagDemo,
);
router.delete(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('vehicle_stock', 'delete', 'superadmin'),
  ctrl.deleteStock,
);

module.exports = router;
