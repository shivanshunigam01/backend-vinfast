const router = require('express').Router();
const validate = require('../../middleware/validate');
const { protect, authorize } = require('../../middleware/auth');
const authController = require('../../controllers/authController');
const dashboardController = require('../../controllers/dashboardController');
const ctrl = require('../../controllers/adminResourceController');
const metaLeadsController = require('../../controllers/metaLeadsController');
const tdBookingsRoutes = require('./tdBookings');
const tdVehiclesRoutes = require('./tdVehicles');
const tdUsersRoutes = require('./tdUsers');
const tdSlotsRoutes = require('./tdSlots');
const tdFeedbackRoutes = require('./tdFeedback');
const tdLogsRoutes = require('./tdLogs');
const tdLeadsRoutes = require('./tdLeads');
const crmLeadsRoutes = require('./crmLeads');
const crmCustomersRoutes = require('./crmCustomers');
const vehicleModelsRoutes = require('./vehicleModels');
const vehicleStockRoutes = require('./vehicleStock');
const seoPagesRoutes = require('./seoPages');
const tdBranchesController = require('../../controllers/tdBranchesController');
const tdReportsController = require('../../controllers/tdReportsController');
const { metaLeadsLimiter } = require('../../middleware/rateLimiter');
const { loginValidator } = require('../../validators/authValidators');
const { mongoIdParam, adminUserValidator, productValidator, mediaValidator, slideReorderValidator } = require('../../validators/adminValidators');

// Auth
router.post('/auth/login', loginValidator, validate, authController.login);
router.get('/auth/me', protect, authController.me);

/** Meta leads — no JWT (proxies META_LEADS_UPSTREAM_URL). Same as GET /api/v1/public/All_leads */
router.get('/All_leads', metaLeadsLimiter, metaLeadsController.getAllMetaLeads);
router.post('/All_leads', metaLeadsLimiter, metaLeadsController.upsertMetaLeadsPayload);

router.use(protect);

// Dashboard
router.get('/dashboard/stats', dashboardController.getStats);

// Leads
router.get('/leads', ctrl.getLeads);
router.post('/leads', ctrl.createLead);
router.get('/leads/:id', mongoIdParam, validate, ctrl.getLead);
router.put('/leads/:id', mongoIdParam, validate, ctrl.updateLead);
router.delete('/leads/:id', mongoIdParam, validate, authorize('superadmin'), ctrl.deleteLead);

// Meta leads (DB-backed webhook records)
router.post('/meta-leads', metaLeadsController.createManualMetaLead);
router.post('/meta-leads/bulk', metaLeadsController.bulkCreateMetaLeads);
router.put('/meta-leads/:id', mongoIdParam, validate, metaLeadsController.updateMetaLead);

// Master data — vehicle models & variants (/api/v1/admin/vehicle-models)
router.use('/vehicle-models', vehicleModelsRoutes);

// Test Drive module (/api/v1/admin/td/*)
router.use('/td/bookings', tdBookingsRoutes);
router.use('/td/vehicles', tdVehiclesRoutes);
router.use('/td/users', tdUsersRoutes);
router.use('/td/slots', tdSlotsRoutes);
router.use('/td/feedback', tdFeedbackRoutes);
router.use('/td/logs', tdLogsRoutes);
router.use('/td/leads', tdLeadsRoutes);

// Standalone Lead CRM module (/api/v1/admin/crm/*)
router.use('/crm/leads', crmLeadsRoutes);
router.use('/crm/customers', crmCustomersRoutes);

// Vehicle stock register with demo tagging (/api/v1/admin/stock/vehicles)
router.use('/stock/vehicles', vehicleStockRoutes);

// SEO module — district landing pages (/api/v1/admin/seo/*)
router.use('/seo', seoPagesRoutes);
router.get('/td/reports/admin', tdReportsController.getAdminReport);
router.get('/td/branches/public', tdBranchesController.listPublicBranches);

// Test drives (legacy CRM)
router.get('/test-drives', ctrl.getTestDrives);
router.get('/test-drives/:id', mongoIdParam, validate, ctrl.getTestDrive);
router.put('/test-drives/:id', mongoIdParam, validate, ctrl.updateTestDrive);
router.delete('/test-drives/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteTestDrive);

// Enquiries
router.get('/enquiries', ctrl.getEnquiries);
router.get('/enquiries/:id', mongoIdParam, validate, ctrl.getEnquiry);
router.put('/enquiries/:id', mongoIdParam, validate, ctrl.updateEnquiry);
router.delete('/enquiries/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteEnquiry);

// Products
router.get('/products', ctrl.getProducts);
router.post('/products', productValidator, validate, ctrl.createProduct);
router.get('/products/:id', mongoIdParam, validate, ctrl.getProduct);
router.put('/products/:id', mongoIdParam, productValidator, validate, ctrl.updateProduct);
router.delete('/products/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteProduct);

// Offers
router.get('/offers', ctrl.getOffers);
router.post('/offers', ctrl.createOffer);
router.get('/offers/:id', mongoIdParam, validate, ctrl.getOffer);
router.put('/offers/:id', mongoIdParam, validate, ctrl.updateOffer);
router.delete('/offers/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteOffer);

// Homepage
router.get('/homepage/slides', ctrl.getSlides);
router.post('/homepage/slides', ctrl.createSlide);
router.put('/homepage/slides/:id', mongoIdParam, validate, ctrl.updateSlide);
router.delete('/homepage/slides/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteSlide);
router.patch('/homepage/slides/reorder', slideReorderValidator, validate, ctrl.reorderSlides);
router.get('/homepage/site-config', ctrl.getSiteConfig);
router.put('/homepage/site-config', ctrl.updateSiteConfig);

// Content
router.get('/content/banners', ctrl.getBanners);
router.post('/content/banners', ctrl.createBanner);
router.get('/content/banners/:id', mongoIdParam, validate, ctrl.getBanner);
router.put('/content/banners/:id', mongoIdParam, validate, ctrl.updateBanner);
router.delete('/content/banners/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteBanner);

router.get('/content/faqs', ctrl.getFaqs);
router.post('/content/faqs', ctrl.createFaq);
router.get('/content/faqs/:id', mongoIdParam, validate, ctrl.getFaq);
router.put('/content/faqs/:id', mongoIdParam, validate, ctrl.updateFaq);
router.delete('/content/faqs/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteFaq);

router.get('/content/testimonials', ctrl.getTestimonials);
router.post('/content/testimonials', ctrl.createTestimonial);
router.get('/content/testimonials/:id', mongoIdParam, validate, ctrl.getTestimonial);
router.put('/content/testimonials/:id', mongoIdParam, validate, ctrl.updateTestimonial);
router.delete('/content/testimonials/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteTestimonial);

// Media
router.get('/media', ctrl.getMedia);
router.post('/media', mediaValidator, validate, ctrl.createMedia);
router.delete('/media/:id', mongoIdParam, validate, authorize('superadmin', 'manager'), ctrl.deleteMedia);

// Settings
router.get('/settings/dealer', ctrl.getDealerSettings);
router.put('/settings/dealer', ctrl.updateDealerSettings);

// Admin users
router.get('/users', authorize('superadmin'), ctrl.getAdmins);
router.post('/users', authorize('superadmin'), adminUserValidator, validate, ctrl.createAdmin);
router.put('/users/:id', authorize('superadmin'), mongoIdParam, adminUserValidator, validate, ctrl.updateAdmin);
router.delete('/users/:id', authorize('superadmin'), mongoIdParam, validate, ctrl.deleteAdmin);

module.exports = router;
