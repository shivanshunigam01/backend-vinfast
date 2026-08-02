require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdUsersController = require('../../controllers/tdUsersController');
const { mongoIdParam } = require('../../validators/adminValidators');
const {
  requireModuleAction,
  requireModuleActionOrRoles,
  canPerformAction,
  hasCustomModuleAcl,
} = require('../../utils/modulePermissions');
const ApiError = require('../../utils/apiError');

/** Allow update, view_password, or manager/superadmin (or unrestricted admin portal). */
function requireTdUsersResetPassword(req, _res, next) {
  const user = req.admin;
  if (!user) return next(new ApiError(401, 'Not authenticated'));
  if (hasCustomModuleAcl(user)) {
    if (
      canPerformAction(user, 'td_users', 'update') ||
      canPerformAction(user, 'td_users', 'view_password')
    ) {
      return next();
    }
    return next(new ApiError(403, 'You do not have permission to reset passwords'));
  }
  if (user.userType && user.userType !== 'tdstaff') return next();
  if (user.role === 'superadmin' || user.role === 'manager') return next();
  return next(new ApiError(403, 'You are not allowed to perform this action'));
}

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
router.post(
  '/:id/reset-password',
  mongoIdParam,
  validate,
  requireTdUsersResetPassword,
  tdUsersController.resetPassword,
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
