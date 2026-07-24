const router = require('express').Router();
const fleetHealthController = require('../../controllers/fleetHealthController');
const { mongoIdParam } = require('../../validators/adminValidators');
const validate = require('../../middleware/validate');

router.get('/health', fleetHealthController.getFleetHealth);
router.get('/charging', fleetHealthController.listChargingLogs);
router.post('/charging', fleetHealthController.createChargingLog);
router.patch('/charging/:id', mongoIdParam, validate, fleetHealthController.updateChargingLog);
router.post('/maintenance', fleetHealthController.createRepairLog);
router.patch('/maintenance/:id', mongoIdParam, validate, fleetHealthController.updateRepairLog);

module.exports = router;
