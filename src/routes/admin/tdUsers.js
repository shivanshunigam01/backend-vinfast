require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdUsersController = require('../../controllers/tdUsersController');
const { mongoIdParam } = require('../../validators/adminValidators');
const { requireModuleAction, requireModuleActionOrRoles } = require('../../utils/modulePermissions');

router.get('/assignable', tdUsersController.listAssignable);
router.get('/', requireModuleAction('td_users', 'view'), tdUsersController.listUsers);
router.post(
  '/',
  requireModuleActionOrRoles('td_users', 'create', 'superadmin', 'manager'),
  tdUsersController.createUser,
);
router.get(
  '/:id/password',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_users', 'view_password', 'superadmin', 'manager'),
  tdUsersController.getUserPassword,
);
router.put(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_users', 'update', 'superadmin', 'manager'),
  tdUsersController.updateUser,
);
router.patch(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_users', 'update', 'superadmin', 'manager'),
  tdUsersController.patchUser,
);
router.delete(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_users', 'delete', 'superadmin', 'manager'),
  tdUsersController.deleteUser,
);

module.exports = router;
