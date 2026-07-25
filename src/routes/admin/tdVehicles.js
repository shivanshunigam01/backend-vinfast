require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdVehiclesController = require('../../controllers/tdVehiclesController');
const { mongoIdParam } = require('../../validators/adminValidators');
const {
  requireModuleAction,
  requireModuleActionOrRoles,
  requireAnyModuleAction,
} = require('../../utils/modulePermissions');

/** Fleet list also powers TD Bookings vehicle assignment. */
router.get(
  '/',
  requireAnyModuleAction([
    ['td_vehicles', 'view'],
    ['td_bookings', 'view'],
    ['td_bookings', 'assign'],
  ]),
  tdVehiclesController.listVehicles,
);
router.post('/', requireModuleAction('td_vehicles', 'create'), tdVehiclesController.createVehicle);
router.patch(
  '/:id/status',
  mongoIdParam,
  validate,
  requireModuleAction('td_vehicles', 'update'),
  tdVehiclesController.updateVehicleStatus,
);
router.put(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleAction('td_vehicles', 'update'),
  tdVehiclesController.updateVehicle,
);
router.patch(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleAction('td_vehicles', 'update'),
  tdVehiclesController.updateVehicle,
);
router.delete(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_vehicles', 'delete', 'superadmin', 'manager'),
  tdVehiclesController.deleteVehicle,
);

module.exports = router;
