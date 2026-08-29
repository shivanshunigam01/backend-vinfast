const router = require('express').Router();
const ctrl = require('../../controllers/stockDeliveryController');
const pipeline = require('../../controllers/stockPipelineController');
const { mongoIdParam } = require('../../validators/adminValidators');
const validate = require('../../middleware/validate');
const { requireModuleAction } = require('../../utils/modulePermissions');

/** Legacy PO paths — delegate to pipeline controller */
router.get('/purchase-orders', requireModuleAction('stock_delivery', 'view'), pipeline.listPurchaseOrders);
router.post('/purchase-orders', requireModuleAction('stock_delivery', 'create'), pipeline.createPurchaseOrder);
router.post(
  '/purchase-orders/:id/release',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'update'),
  pipeline.releasePurchaseOrder,
);

router.get('/orders/availability', requireModuleAction('stock_delivery', 'view'), ctrl.availability);

router.post(
  '/stock/:id/yard-pdi',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'pdi'),
  ctrl.yardPdi,
);
router.get('/orders', requireModuleAction('stock_delivery', 'view'), ctrl.listOrders);
router.post('/orders', requireModuleAction('stock_delivery', 'create'), ctrl.createOrder);
router.post(
  '/orders/backfill-booking',
  requireModuleAction('stock_delivery', 'create'),
  ctrl.backfillBookingOrders,
);
router.get('/orders/:id', mongoIdParam, validate, requireModuleAction('stock_delivery', 'view'), ctrl.getOrder);
router.post(
  '/orders/:id/allocate',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'allocate'),
  ctrl.allocateOrder,
);
router.post(
  '/orders/:id/release',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'allocate'),
  ctrl.releaseOrder,
);
router.patch(
  '/orders/:id/payment',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'update'),
  ctrl.updatePayment,
);
router.patch(
  '/orders/:id/insurance',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'update'),
  ctrl.updateInsurance,
);
router.patch(
  '/orders/:id/registration',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'update'),
  ctrl.updateRegistration,
);
router.post(
  '/orders/:id/final-pdi',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'pdi'),
  ctrl.finalPdi,
);
router.post(
  '/orders/:id/retail-sale',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'deliver'),
  ctrl.retailSale,
);
router.post(
  '/orders/:id/delivery-ready',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'deliver'),
  ctrl.markDeliveryReady,
);
router.post(
  '/orders/:id/deliver',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'deliver'),
  ctrl.deliverOrder,
);

router.get('/deliveries', requireModuleAction('stock_delivery', 'view'), ctrl.listDeliveries);

module.exports = router;
