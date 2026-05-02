const router = require('express').Router();
const validate = require('../../middleware/validate');
const { formLimiter, otpSendLimiter, otpVerifyLimiter } = require('../../middleware/rateLimiter');
const verifyRecaptcha = require('../../middleware/verifyRecaptcha');
const verifyWhatsappOtp = require('../../middleware/verifyWhatsappOtp');
const publicController = require('../../controllers/publicController');
const formController = require('../../controllers/formController');
const whatsappOtpController = require('../../controllers/whatsappOtpController');
const { leadValidator, testDriveValidator, enquiryValidator } = require('../../validators/formValidators');
const { whatsappOtpSendValidator, whatsappOtpVerifyValidator } = require('../../validators/whatsappOtpValidators');

router.get('/public/site-config', publicController.getSiteConfig);
router.get('/public/hero-slides', publicController.getHeroSlides);
router.get('/public/products', publicController.getProducts);
router.get('/public/products/:slug', publicController.getProductBySlug);
router.get('/public/offers', publicController.getOffers);
router.get('/public/banners', publicController.getBanners);
router.get('/public/faqs', publicController.getFAQs);
router.get('/public/testimonials', publicController.getTestimonials);
router.get('/public/dealer-settings', publicController.getDealerSettings);

router.post(
  '/whatsapp-otp/send',
  otpSendLimiter,
  verifyRecaptcha,
  whatsappOtpSendValidator,
  validate,
  whatsappOtpController.sendOtp
);
router.post(
  '/whatsapp-otp/verify',
  otpVerifyLimiter,
  whatsappOtpVerifyValidator,
  validate,
  whatsappOtpController.verifyOtp
);

router.post('/leads', formLimiter, verifyRecaptcha, verifyWhatsappOtp, leadValidator, validate, formController.createLead);
router.post(
  '/test-drives',
  formLimiter,
  verifyRecaptcha,
  verifyWhatsappOtp,
  testDriveValidator,
  validate,
  formController.createTestDrive
);
router.post(
  '/enquiries',
  formLimiter,
  verifyRecaptcha,
  verifyWhatsappOtp,
  enquiryValidator,
  validate,
  formController.createEnquiry
);

module.exports = router;
