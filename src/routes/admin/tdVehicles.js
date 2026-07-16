require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdVehiclesController = require('../../controllers/tdVehiclesController');
const { mongoIdParam } = require('../../validators/adminValidators');

router.get('/', tdVehiclesController.listVehicles);
router.post('/', tdVehiclesController.createVehicle);
router.patch('/:id/status', mongoIdParam, validate, tdVehiclesController.updateVehicleStatus);
router.put('/:id', mongoIdParam, validate, tdVehiclesController.updateVehicle);
router.patch('/:id', mongoIdParam, validate, tdVehiclesController.updateVehicle);
router.delete('/:id', mongoIdParam, validate, tdVehiclesController.deleteVehicle);

module.exports = router;
