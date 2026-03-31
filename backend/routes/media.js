const express = require('express');
const controller = require('../controllers/mediaController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { mediaValidation, objectIdParam } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/', controller.getMedia);
router.post('/', validate(mediaValidation), controller.createMedia);
router.delete('/:id', validate([objectIdParam()]), controller.deleteMedia);

module.exports = router;
