const router = require('express').Router();
const validate = require('../../middleware/validate');
const { formLimiter, otpSendLimiter, otpVerifyLimiter } = require('../../middleware/rateLimiter');
const verifyRecaptcha = require('../../middleware/verifyRecaptcha');
const verifyWhatsappOtp = require('../../middleware/verifyWhatsappOtp');
const publicController = require('../../controllers/publicController');
const formController = require('../../controllers/formController');
const whatsappOtpController = require('../../controllers/whatsappOtpController');
const tdBranchesController = require('../../controllers/tdBranchesController');
const tdSlotsController = require('../../controllers/tdSlotsController');
const vehicleModelsController = require('../../controllers/vehicleModelsController');
const seoController = require('../../controllers/seoController');
const { leadValidator, testDriveValidator, enquiryValidator } = require('../../validators/formValidators');
const postDeliveryFeedbackController = require('../../controllers/postDeliveryFeedbackController');
const { postDeliveryFeedbackValidator } = require('../../validators/postDeliveryFeedbackValidators');
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
router.get('/public/vehicle-models', vehicleModelsController.getPublicCatalog);

// SEO / AEO endpoints (district landing pages, JSON-LD schemas, sitemap data)
router.get('/public/seo/global', seoController.getGlobalSeo);
router.get('/public/seo/districts', seoController.getDistricts);
router.get('/public/seo/models', seoController.getSeoModels);
router.get('/public/seo/district-pages', seoController.listDistrictPages);
router.get('/public/seo/district-pages/:districtSlug/:modelSlug', seoController.getDistrictPage);

router.get('/public/td/branches', tdBranchesController.listPublicBranches);
router.get('/public/td/slots/available', tdSlotsController.publicAvailableSlots);

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

router.post(
  '/leads',
  formLimiter,
  verifyRecaptcha,
  verifyWhatsappOtp(),
  leadValidator,
  validate,
  formController.createLead
);
router.post(
  '/test-drives',
  formLimiter,
  verifyRecaptcha,
  // Hard requirement: test drives must come from an OTP-verified mobile (blocks junk CRM leads).
  verifyWhatsappOtp({ required: true }),
  testDriveValidator,
  validate,
  formController.createTestDrive
);
router.post(
  '/enquiries',
  formLimiter,
  verifyRecaptcha,
  verifyWhatsappOtp(),
  enquiryValidator,
  validate,
  formController.createEnquiry
);

// Post-delivery feedback form (URL-only page, reached via QR code — no OTP/recaptcha step).
router.post(
  '/post-delivery-feedback',
  formLimiter,
  postDeliveryFeedbackValidator,
  validate,
  postDeliveryFeedbackController.createPostDeliveryFeedback
);

module.exports = router;
