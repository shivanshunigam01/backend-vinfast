const router = require('express').Router();
const validate = require('../../middleware/validate');
const vehicleModelsController = require('../../controllers/vehicleModelsController');
const { mongoIdParam } = require('../../validators/adminValidators');

router.get('/', vehicleModelsController.listModels);
router.post('/', vehicleModelsController.createModel);
router.put('/:id', mongoIdParam, validate, vehicleModelsController.updateModel);
router.delete('/:id', mongoIdParam, validate, vehicleModelsController.deleteModel);

module.exports = router;
