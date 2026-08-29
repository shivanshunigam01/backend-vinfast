const router = require('express').Router();
const ctrl = require('../../controllers/stockPipelineController');
const configCtrl = require('../../controllers/stockConfigController');
const { mongoIdParam } = require('../../validators/adminValidators');
const validate = require('../../middleware/validate');
const { requireModuleAction, requireAnyModuleAction } = require('../../utils/modulePermissions');
const uploadStockPhotos = require('../../middleware/uploadStockPhotos');

function mod(action) {
  return requireAnyModuleAction([
    [`stock_${action}`, 'view'],
    ['stock_delivery', action === 'view' ? 'view' : 'update'],
    ['vehicle_stock', action === 'view' ? 'view' : 'update'],
  ]);
}

/** Config */
router.get('/config', mod('view'), configCtrl.getConfig);
router.put('/config', requireAnyModuleAction([['stock_config', 'update'], ['stock_delivery', 'update']]), configCtrl.updateConfig);
router.get('/locations', mod('view'), configCtrl.listLocations);
router.put('/locations', requireAnyModuleAction([['stock_config', 'update'], ['stock_delivery', 'update']]), configCtrl.upsertLocation);

/** Dashboard */
router.get('/dashboard', mod('view'), ctrl.getDashboard);

/** Purchase Orders */
router.get('/purchase-orders', mod('view'), ctrl.listPurchaseOrders);
router.post('/purchase-orders', requireAnyModuleAction([['stock_po', 'create'], ['stock_delivery', 'create']]), ctrl.createPurchaseOrder);
router.get('/purchase-orders/:id', mongoIdParam, validate, mod('view'), ctrl.getPurchaseOrder);
router.put('/purchase-orders/:id', mongoIdParam, validate, requireAnyModuleAction([['stock_po', 'update'], ['stock_delivery', 'update']]), ctrl.updatePurchaseOrder);
router.post('/purchase-orders/:id/submit', mongoIdParam, validate, requireAnyModuleAction([['stock_po', 'update'], ['stock_delivery', 'update']]), ctrl.submitPurchaseOrder);
router.post('/purchase-orders/:id/approve', mongoIdParam, validate, requireAnyModuleAction([['stock_po', 'approve'], ['stock_delivery', 'update']]), ctrl.approvePurchaseOrder);
router.post('/purchase-orders/:id/reject', mongoIdParam, validate, requireAnyModuleAction([['stock_po', 'approve'], ['stock_delivery', 'update']]), ctrl.rejectPurchaseOrder);
router.post('/purchase-orders/:id/release', mongoIdParam, validate, requireAnyModuleAction([['stock_po', 'update'], ['stock_delivery', 'update']]), ctrl.releasePurchaseOrder);
router.post('/purchase-orders/:id/cancel', mongoIdParam, validate, requireAnyModuleAction([['stock_po', 'update'], ['stock_delivery', 'update']]), ctrl.cancelPurchaseOrder);

/** Dispatch */
router.get('/dispatches', mod('view'), ctrl.listDispatches);
router.post('/dispatches', requireAnyModuleAction([['stock_dispatch', 'create'], ['stock_delivery', 'create']]), ctrl.createDispatch);

/** Gate Entry */
router.get('/gate-entries', mod('view'), ctrl.listGateEntries);
router.post('/gate-entries', requireAnyModuleAction([['stock_gate', 'create'], ['stock_delivery', 'receive']]), uploadStockPhotos, ctrl.createGateEntry);

/** GRN */
router.get('/grns', mod('view'), ctrl.listGrns);
router.post('/grns', requireAnyModuleAction([['stock_grn', 'create'], ['stock_delivery', 'receive']]), uploadStockPhotos, ctrl.createGrn);

/** Receipt */
router.get('/receipts', mod('view'), ctrl.listReceipts);
router.get('/receipts/queue', mod('view'), ctrl.listReceiptQueue);
router.post('/receipts', requireAnyModuleAction([['stock_receipt', 'create'], ['stock_delivery', 'receive']]), ctrl.createReceipt);

/** Pre-Stock PDI */
router.get('/pdi/queue', mod('view'), ctrl.listPdiQueue);
router.get('/pdi', mod('view'), ctrl.listPdis);
router.post('/pdi/:id/pre-stock', mongoIdParam, validate, requireAnyModuleAction([['stock_pdi', 'create'], ['stock_delivery', 'pdi']]), ctrl.createPreStockPdi);

/** Rectification */
router.get('/rectifications', mod('view'), ctrl.listRectifications);
router.patch('/rectifications/:id', mongoIdParam, validate, requireAnyModuleAction([['stock_rectification', 'update'], ['stock_delivery', 'update']]), ctrl.updateRectification);

/** Stock ops */
router.post('/vehicles/:id/hold', mongoIdParam, validate, requireAnyModuleAction([['stock_inventory', 'update'], ['stock_delivery', 'update']]), ctrl.placeHold);
router.post('/vehicles/:id/release-hold', mongoIdParam, validate, requireAnyModuleAction([['stock_inventory', 'update'], ['stock_delivery', 'update']]), ctrl.releaseHold);
router.post('/vehicles/:id/move', mongoIdParam, validate, requireAnyModuleAction([['stock_inventory', 'update'], ['vehicle_stock', 'update']]), ctrl.moveStock);
router.post('/vehicles/:id/charging', mongoIdParam, validate, requireAnyModuleAction([['stock_inventory', 'update'], ['vehicle_stock', 'update']]), ctrl.logCharging);
router.get('/vehicles/:id/360', mongoIdParam, validate, mod('view'), ctrl.getVehicle360);

module.exports = router;
