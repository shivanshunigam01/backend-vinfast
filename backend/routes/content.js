const express = require('express');
const controller = require('../controllers/contentController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { bannerValidation, faqValidation, testimonialValidation, objectIdParam } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/banners', controller.getBanners);
router.post('/banners', validate(bannerValidation), controller.createBanner);
router.put('/banners/:id', validate([objectIdParam(), ...bannerValidation]), controller.updateBanner);
router.delete('/banners/:id', validate([objectIdParam()]), controller.deleteBanner);

router.get('/faqs', controller.getFaqs);
router.post('/faqs', validate(faqValidation), controller.createFaq);
router.put('/faqs/:id', validate([objectIdParam(), ...faqValidation]), controller.updateFaq);
router.delete('/faqs/:id', validate([objectIdParam()]), controller.deleteFaq);

router.get('/testimonials', controller.getTestimonials);
router.post('/testimonials', validate(testimonialValidation), controller.createTestimonial);
router.put('/testimonials/:id', validate([objectIdParam(), ...testimonialValidation]), controller.updateTestimonial);
router.delete('/testimonials/:id', validate([objectIdParam()]), controller.deleteTestimonial);

module.exports = router;
