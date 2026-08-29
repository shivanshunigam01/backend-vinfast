const router = require('express').Router();
const validate = require('../../middleware/validate');
const { protect, authorize, requireModuleAction } = require('../../middleware/auth');
const { requireModuleActionOrRoles, requireAnyModuleAction } = require('../../utils/modulePermissions');
const authController = require('../../controllers/authController');
const staffForgotPasswordController = require('../../controllers/staffForgotPasswordController');
const dashboardController = require('../../controllers/dashboardController');
const ctrl = require('../../controllers/adminResourceController');
const metaLeadsController = require('../../controllers/metaLeadsController');
const tdBookingsRoutes = require('./tdBookings');
const tdVehiclesRoutes = require('./tdVehicles');
const tdUsersRoutes = require('./tdUsers');
const tdRolesRoutes = require('./tdRoles');
const tdSlotsRoutes = require('./tdSlots');
const tdFeedbackRoutes = require('./tdFeedback');
const tdLogsRoutes = require('./tdLogs');
const tdLeadsRoutes = require('./tdLeads');
const crmLeadsRoutes = require('./crmLeads');
const crmCustomersRoutes = require('./crmCustomers');
const leadStagesRoutes = require('./leadStages');
const pricingRoutes = require('./pricing');
const vehicleModelsRoutes = require('./vehicleModels');
const vehicleStockRoutes = require('./vehicleStock');
const seoPagesRoutes = require('./seoPages');
const fleetHealthRoutes = require('./fleetHealth');
const tdBranchesController = require('../../controllers/tdBranchesController');
const tdReportsController = require('../../controllers/tdReportsController');
const leadReportController = require('../../controllers/leadReportController');
const postDeliveryFeedbackController = require('../../controllers/postDeliveryFeedbackController');
const testDriveFeedbackController = require('../../controllers/testDriveFeedbackController');
const calendarController = require('../../controllers/calendarController');
const geocodeController = require('../../controllers/geocodeController');
const { metaLeadsLimiter } = require('../../middleware/rateLimiter');
const { otpSendLimiter, otpVerifyLimiter } = require('../../middleware/rateLimiter');
const { loginValidator } = require('../../validators/authValidators');
const { mongoIdParam, adminUserValidator, productValidator, mediaValidator, slideReorderValidator } = require('../../validators/adminValidators');

// Auth — isolated portals (Admin vs Staff)
router.post('/auth/login', loginValidator, validate, authController.adminLogin);
router.post('/auth/staff-login', loginValidator, validate, authController.staffLogin);
router.post(
  '/auth/staff-forgot/send-otp',
  otpSendLimiter,
  staffForgotPasswordController.sendOtp,
);
router.post(
  '/auth/staff-forgot/verify-otp',
  otpVerifyLimiter,
  staffForgotPasswordController.verifyOtp,
);
router.post(
  '/auth/staff-forgot/reset',
  otpVerifyLimiter,
  staffForgotPasswordController.resetPassword,
);
router.get('/auth/me', protect, authController.me);
router.put('/auth/profile', protect, authController.updateProfile);
router.post('/auth/change-password', protect, authController.changePassword);

/** Meta leads — no JWT (proxies META_LEADS_UPSTREAM_URL). Same as GET /api/v1/public/All_leads */
router.get('/All_leads', metaLeadsLimiter, metaLeadsController.getAllMetaLeads);
router.post('/All_leads', metaLeadsLimiter, metaLeadsController.upsertMetaLeadsPayload);

router.use(protect);

// Dashboard
router.get('/dashboard/stats', dashboardController.getStats);
router.get(
  '/dashboard/calendar',
  requireModuleAction('calendar', 'view'),
  calendarController.getCalendarEvents,
);
router.patch(
  '/dashboard/calendar/events/:id',
  requireAnyModuleAction([
    ['calendar', 'update'],
    ['crm_leads', 'update'],
    ['td_bookings', 'update'],
    ['td_bookings', 'reschedule'],
    ['td_my_bookings', 'reschedule'],
  ]),
  calendarController.patchCalendarEvent,
);
router.get('/geocode/reverse', geocodeController.reverseGeocode);
router.post('/geocode/reverse', geocodeController.reverseGeocode);

// Leads
router.get('/leads', requireModuleAction('crm_leads', 'view'), ctrl.getLeads);
router.post('/leads', requireModuleAction('crm_leads', 'create'), ctrl.createLead);
router.get('/leads/:id', mongoIdParam, validate, requireModuleAction('crm_leads', 'view'), ctrl.getLead);
router.put('/leads/:id', mongoIdParam, validate, requireModuleAction('crm_leads', 'update'), ctrl.updateLead);
router.delete(
  '/leads/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('crm_leads', 'delete', 'superadmin'),
  ctrl.deleteLead,
);

// Meta leads (DB-backed webhook records)
router.post('/meta-leads', requireModuleAction('crm_leads', 'create'), metaLeadsController.createManualMetaLead);
router.post('/meta-leads/bulk', requireModuleAction('crm_leads', 'create'), metaLeadsController.bulkCreateMetaLeads);
router.put(
  '/meta-leads/:id',
  mongoIdParam,
  validate,
  requireModuleAction('crm_leads', 'update'),
  metaLeadsController.updateMetaLead,
);
router.delete(
  '/meta-leads/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('crm_leads', 'delete', 'superadmin', 'manager'),
  metaLeadsController.deleteMetaLead,
);

// Master data — vehicle models & variants (/api/v1/admin/vehicle-models)
router.use('/vehicle-models', vehicleModelsRoutes);

// Test Drive module (/api/v1/admin/td/*)
router.use('/td/bookings', tdBookingsRoutes);
router.use('/td/vehicles', tdVehiclesRoutes);
router.use('/td/users', tdUsersRoutes);
router.use('/td/roles', tdRolesRoutes);
router.use('/td/slots', tdSlotsRoutes);
router.use('/td/feedback', tdFeedbackRoutes);
router.use('/td/logs', tdLogsRoutes);
router.use('/td/leads', tdLeadsRoutes);
router.use('/td/fleet', fleetHealthRoutes);

// Standalone Lead CRM module (/api/v1/admin/crm/*)
router.use('/crm/leads', crmLeadsRoutes);
router.use('/crm/customers', crmCustomersRoutes);
router.use('/crm/lead-stages', leadStagesRoutes);
router.use('/crm/buyer-types', require('./buyerTypes'));
router.use('/notifications', require('./notifications'));

// Vehicle pricing (/api/v1/admin/pricing)
router.use('/pricing', pricingRoutes);

// Vehicle stock register with demo tagging (/api/v1/admin/stock/vehicles)
router.use('/stock/vehicles', vehicleStockRoutes);
router.use('/stock/vendors', require('./vendors'));
// Stock pipeline — PO → Dispatch → Gate → GRN → Receipt → PDI (/api/v1/admin/stock/pipeline)
router.use('/stock/pipeline', require('./stockPipeline'));
// Stock-to-Delivery ops (/api/v1/admin/stock-delivery/*)
router.use('/stock-delivery', require('./stockDelivery'));

// Customer feedback form submissions (QR pages) — admin viewer
router.get(
  '/feedback/post-delivery',
  requireModuleAction('feedback_post_delivery', 'view'),
  postDeliveryFeedbackController.listPostDeliveryFeedback,
);
router.delete(
  '/feedback/post-delivery/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('feedback_post_delivery', 'delete', 'superadmin', 'manager'),
  postDeliveryFeedbackController.deletePostDeliveryFeedback,
);
router.get(
  '/feedback/test-drive',
  requireModuleAction('feedback_test_drive', 'view'),
  testDriveFeedbackController.listTestDriveFeedback,
);
router.delete(
  '/feedback/test-drive/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('feedback_test_drive', 'delete', 'superadmin', 'manager'),
  testDriveFeedbackController.deleteTestDriveFeedback,
);

// SEO module — district landing pages (/api/v1/admin/seo/*)
router.use('/seo', seoPagesRoutes);
router.get(
  '/td/reports/admin',
  requireModuleAction('td_reports', 'view'),
  tdReportsController.getAdminReport,
);
router.get(
  '/reports/deliveries',
  requireModuleAction('delivery_reports', 'view'),
  leadReportController.getDeliveryReport,
);
router.get(
  '/crm/reports/deliveries',
  requireModuleAction('delivery_reports', 'view'),
  leadReportController.getDeliveryReport,
);
router.get('/td/branches/public', tdBranchesController.listPublicBranches);

// Test drives (legacy CRM)
router.get('/test-drives', requireModuleAction('td_bookings', 'view'), ctrl.getTestDrives);
router.get('/test-drives/:id', mongoIdParam, validate, requireModuleAction('td_bookings', 'view'), ctrl.getTestDrive);
router.put('/test-drives/:id', mongoIdParam, validate, requireModuleAction('td_bookings', 'update'), ctrl.updateTestDrive);
router.delete(
  '/test-drives/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_bookings', 'cancel', 'superadmin', 'manager'),
  ctrl.deleteTestDrive,
);

// Enquiries
router.get('/enquiries', requireModuleAction('crm_leads', 'view'), ctrl.getEnquiries);
router.get('/enquiries/:id', mongoIdParam, validate, requireModuleAction('crm_leads', 'view'), ctrl.getEnquiry);
router.put('/enquiries/:id', mongoIdParam, validate, requireModuleAction('crm_leads', 'update'), ctrl.updateEnquiry);
router.delete(
  '/enquiries/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('crm_leads', 'delete', 'superadmin', 'manager'),
  ctrl.deleteEnquiry,
);

// Products
router.get('/products', requireModuleAction('products', 'view'), ctrl.getProducts);
router.post('/products', requireModuleAction('products', 'create'), productValidator, validate, ctrl.createProduct);
router.get('/products/:id', mongoIdParam, validate, requireModuleAction('products', 'view'), ctrl.getProduct);
router.put(
  '/products/:id',
  mongoIdParam,
  productValidator,
  validate,
  requireModuleAction('products', 'update'),
  ctrl.updateProduct,
);
router.delete(
  '/products/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('products', 'delete', 'superadmin', 'manager'),
  ctrl.deleteProduct,
);

// Offers
router.get('/offers', requireModuleAction('offers', 'view'), ctrl.getOffers);
router.post('/offers', requireModuleAction('offers', 'create'), ctrl.createOffer);
router.get('/offers/:id', mongoIdParam, validate, requireModuleAction('offers', 'view'), ctrl.getOffer);
router.put('/offers/:id', mongoIdParam, validate, requireModuleAction('offers', 'update'), ctrl.updateOffer);
router.delete(
  '/offers/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('offers', 'delete', 'superadmin', 'manager'),
  ctrl.deleteOffer,
);

// Homepage
router.get('/homepage/slides', requireModuleAction('homepage', 'view'), ctrl.getSlides);
router.post('/homepage/slides', requireModuleAction('homepage', 'create'), ctrl.createSlide);
router.put(
  '/homepage/slides/:id',
  mongoIdParam,
  validate,
  requireModuleAction('homepage', 'update'),
  ctrl.updateSlide,
);
router.delete(
  '/homepage/slides/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('homepage', 'delete', 'superadmin', 'manager'),
  ctrl.deleteSlide,
);
router.patch(
  '/homepage/slides/reorder',
  slideReorderValidator,
  validate,
  requireModuleAction('homepage', 'update'),
  ctrl.reorderSlides,
);
router.get('/homepage/site-config', requireModuleAction('homepage', 'view'), ctrl.getSiteConfig);
router.put('/homepage/site-config', requireModuleAction('homepage', 'update'), ctrl.updateSiteConfig);

// Content
router.get('/content/banners', requireModuleAction('content', 'view'), ctrl.getBanners);
router.post('/content/banners', requireModuleAction('content', 'create'), ctrl.createBanner);
router.get('/content/banners/:id', mongoIdParam, validate, requireModuleAction('content', 'view'), ctrl.getBanner);
router.put(
  '/content/banners/:id',
  mongoIdParam,
  validate,
  requireModuleAction('content', 'update'),
  ctrl.updateBanner,
);
router.delete(
  '/content/banners/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('content', 'delete', 'superadmin', 'manager'),
  ctrl.deleteBanner,
);

router.get('/content/faqs', requireModuleAction('content', 'view'), ctrl.getFaqs);
router.post('/content/faqs', requireModuleAction('content', 'create'), ctrl.createFaq);
router.get('/content/faqs/:id', mongoIdParam, validate, requireModuleAction('content', 'view'), ctrl.getFaq);
router.put('/content/faqs/:id', mongoIdParam, validate, requireModuleAction('content', 'update'), ctrl.updateFaq);
router.delete(
  '/content/faqs/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('content', 'delete', 'superadmin', 'manager'),
  ctrl.deleteFaq,
);

router.get('/content/testimonials', requireModuleAction('content', 'view'), ctrl.getTestimonials);
router.post('/content/testimonials', requireModuleAction('content', 'create'), ctrl.createTestimonial);
router.get(
  '/content/testimonials/:id',
  mongoIdParam,
  validate,
  requireModuleAction('content', 'view'),
  ctrl.getTestimonial,
);
router.put(
  '/content/testimonials/:id',
  mongoIdParam,
  validate,
  requireModuleAction('content', 'update'),
  ctrl.updateTestimonial,
);
router.delete(
  '/content/testimonials/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('content', 'delete', 'superadmin', 'manager'),
  ctrl.deleteTestimonial,
);

// Media
router.get('/media', requireModuleAction('media', 'view'), ctrl.getMedia);
router.post('/media', requireModuleAction('media', 'create'), mediaValidator, validate, ctrl.createMedia);
router.delete(
  '/media/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('media', 'delete', 'superadmin', 'manager'),
  ctrl.deleteMedia,
);

// Settings
router.get('/settings/dealer', requireModuleAction('settings', 'view'), ctrl.getDealerSettings);
router.put('/settings/dealer', requireModuleAction('settings', 'update'), ctrl.updateDealerSettings);

// Admin users
router.get('/users', authorize('superadmin'), ctrl.getAdmins);
router.post('/users', authorize('superadmin'), adminUserValidator, validate, ctrl.createAdmin);
router.put('/users/:id', authorize('superadmin'), mongoIdParam, adminUserValidator, validate, ctrl.updateAdmin);
router.delete('/users/:id', authorize('superadmin'), mongoIdParam, validate, ctrl.deleteAdmin);

module.exports = router;
