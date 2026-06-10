const express = require('express');
const ctrl = require('../../controllers/demoVehicleController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// Public: available vehicles
router.get('/available', ctrl.getAvailableVehicles);

// All admin routes below require auth
router.use(protect);

router.get('/', ctrl.getVehicles);
router.get('/:id', ctrl.getVehicleById);
router.get('/:id/history', ctrl.getVehicleHistory);
router.post('/', authorize('superadmin', 'manager'), ctrl.createVehicle);
router.put('/:id', authorize('superadmin', 'manager'), ctrl.updateVehicle);
router.delete('/:id', authorize('superadmin'), ctrl.deleteVehicle);

router.put('/:id/status', ctrl.updateVehicleStatus);
router.post('/:id/charging/start', ctrl.startCharging);
router.post('/:id/charging/complete', ctrl.completeCharging);
router.post('/:id/repair/start', authorize('superadmin', 'manager'), ctrl.startRepair);
router.post('/:id/repair/complete', authorize('superadmin', 'manager'), ctrl.completeRepair);

module.exports = router;
