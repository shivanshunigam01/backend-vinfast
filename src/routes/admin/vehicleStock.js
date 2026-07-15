const router = require('express').Router();
const validate = require('../../middleware/validate');
const ctrl = require('../../controllers/vehicleStockController');
const { mongoIdParam, vehicleStockValidator } = require('../../validators/adminValidators');

/** Vehicle stock register (/api/v1/admin/stock/vehicles) */
router.get('/', ctrl.listStock);
router.post('/', vehicleStockValidator, validate, ctrl.createStock);
router.get('/:id', mongoIdParam, validate, ctrl.getStock);
router.put('/:id', mongoIdParam, validate, ctrl.updateStock);
router.patch('/:id', mongoIdParam, validate, ctrl.updateStock);
router.patch('/:id/demo', mongoIdParam, validate, ctrl.tagDemo);
router.delete('/:id', mongoIdParam, validate, ctrl.deleteStock);

module.exports = router;
