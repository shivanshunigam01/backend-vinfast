const router = require('express').Router();
const validate = require('../../middleware/validate');
const vehicleModelsController = require('../../controllers/vehicleModelsController');
const { mongoIdParam } = require('../../validators/adminValidators');
const { requireModuleAction, requireModuleActionOrRoles } = require('../../utils/modulePermissions');

router.get('/', requireModuleAction('td_models', 'view'), vehicleModelsController.listModels);
router.post('/', requireModuleAction('td_models', 'create'), vehicleModelsController.createModel);
router.put(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleAction('td_models', 'update'),
  vehicleModelsController.updateModel,
);
router.delete(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_models', 'delete', 'superadmin', 'manager'),
  vehicleModelsController.deleteModel,
);

module.exports = router;
