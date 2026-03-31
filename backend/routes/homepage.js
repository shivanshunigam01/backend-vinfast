const express = require('express');
const controller = require('../controllers/homepageController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { heroSlideValidation, objectIdParam } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/slides', controller.getAdminSlides);
router.post('/slides', validate(heroSlideValidation), controller.createSlide);
router.put('/slides/:id', validate([objectIdParam(), ...heroSlideValidation]), controller.updateSlide);
router.delete('/slides/:id', validate([objectIdParam()]), controller.deleteSlide);

router.get('/config', controller.getAdminConfig);
router.put('/config', controller.updateConfig);

module.exports = router;
