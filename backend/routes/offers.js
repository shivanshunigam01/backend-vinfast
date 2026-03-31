const express = require('express');
const controller = require('../controllers/offerController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { offerValidation, objectIdParam } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/', controller.getAdminOffers);
router.post('/', validate(offerValidation), controller.createOffer);
router.put('/:id', validate([objectIdParam(), ...offerValidation]), controller.updateOffer);
router.delete('/:id', validate([objectIdParam()]), controller.deleteOffer);

module.exports = router;
