const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdRolesController = require('../../controllers/tdRolesController');
const { mongoIdParam } = require('../../validators/adminValidators');
const { requireModuleAction, requireModuleActionOrRoles } = require('../../utils/modulePermissions');

router.get('/', requireModuleAction('td_users', 'view'), tdRolesController.listRoles);
router.post(
  '/',
  requireModuleActionOrRoles('td_users', 'create', 'superadmin', 'manager'),
  tdRolesController.createRole,
);
router.get(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleAction('td_users', 'view'),
  tdRolesController.getRole,
);
router.put(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_users', 'update', 'superadmin', 'manager'),
  tdRolesController.updateRole,
);
router.delete(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_users', 'delete', 'superadmin', 'manager'),
  tdRolesController.deleteRole,
);

module.exports = router;
