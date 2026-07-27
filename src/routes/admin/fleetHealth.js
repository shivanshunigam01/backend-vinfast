const router = require('express').Router();
const fleetHealthController = require('../../controllers/fleetHealthController');
const { mongoIdParam } = require('../../validators/adminValidators');
const validate = require('../../middleware/validate');
const { requireModuleAction } = require('../../utils/modulePermissions');

router.get('/health', requireModuleAction('td_fleet_health', 'view'), fleetHealthController.getFleetHealth);
router.get(
  '/charging',
  requireModuleAction('td_fleet_health', 'view'),
  fleetHealthController.listChargingLogs,
);
router.post(
  '/charging',
  requireModuleAction('td_fleet_health', 'schedule_charge'),
  fleetHealthController.createChargingLog,
);
router.patch(
  '/charging/:id',
  mongoIdParam,
  validate,
  requireModuleAction('td_fleet_health', 'schedule_charge'),
  fleetHealthController.updateChargingLog,
);
router.post(
  '/maintenance',
  requireModuleAction('td_fleet_health', 'log_maintenance'),
  fleetHealthController.createRepairLog,
);
router.patch(
  '/maintenance/:id',
  mongoIdParam,
  validate,
  requireModuleAction('td_fleet_health', 'log_maintenance'),
  fleetHealthController.updateRepairLog,
);

module.exports = router;
