const express = require('express');
const homepageController = require('../controllers/homepageController');
const productController = require('../controllers/productController');
const offerController = require('../controllers/offerController');
const contentController = require('../controllers/contentController');

const router = express.Router();

router.get('/config', homepageController.getPublicConfig);
router.get('/products', productController.getPublicProducts);
router.get('/products/:slug', productController.getPublicProductBySlug);
router.get('/hero-slides', homepageController.getPublicHeroSlides);
router.get('/offers', offerController.getPublicOffers);
router.get('/banners', contentController.getPublicBanners);
router.get('/faqs', contentController.getPublicFaqs);
router.get('/testimonials', contentController.getPublicTestimonials);

module.exports = router;
