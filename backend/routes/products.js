const express = require('express');
const controller = require('../controllers/productController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { productValidation, objectIdParam } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/', controller.getAdminProducts);
router.post('/', validate(productValidation), controller.createProduct);
router.put('/:id', validate([objectIdParam(), ...productValidation]), controller.updateProduct);
router.delete('/:id', validate([objectIdParam()]), controller.deleteProduct);

module.exports = router;
