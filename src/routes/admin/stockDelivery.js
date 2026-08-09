const router = require('express').Router();
const ctrl = require('../../controllers/stockDeliveryController');
const { mongoIdParam } = require('../../validators/adminValidators');
const validate = require('../../middleware/validate');
const { requireModuleAction } = require('../../utils/modulePermissions');

/** Static paths before /:id */
router.get('/purchase-orders', requireModuleAction('stock_delivery', 'view'), ctrl.listPurchaseOrders);
router.post('/purchase-orders', requireModuleAction('stock_delivery', 'create'), ctrl.createPurchaseOrder);
router.post(
  '/purchase-orders/:id/raise',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'update'),
  ctrl.raisePurchaseOrder,
);
router.post(
  '/purchase-orders/:id/receive-transit',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'receive'),
  ctrl.receiveTransit,
);

router.post(
  '/stock/:id/yard-pdi',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'pdi'),
  ctrl.yardPdi,
);

router.get('/orders/availability', requireModuleAction('stock_delivery', 'view'), ctrl.availability);
router.get('/orders', requireModuleAction('stock_delivery', 'view'), ctrl.listOrders);
router.post('/orders', requireModuleAction('stock_delivery', 'create'), ctrl.createOrder);
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
  '/orders/:id/deliver',
  mongoIdParam,
  validate,
  requireModuleAction('stock_delivery', 'deliver'),
  ctrl.deliverOrder,
);

router.get('/deliveries', requireModuleAction('stock_delivery', 'view'), ctrl.listDeliveries);

module.exports = router;
