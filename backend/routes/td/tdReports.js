const express = require('express');
const ctrl = require('../../controllers/tdReportController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/summary', ctrl.reportSummary);
router.get('/daily', ctrl.dailyBookingReport);
router.get('/vehicle-utilization', ctrl.vehicleUtilizationReport);
router.get('/executive-productivity', ctrl.executiveProductivityReport);
router.get('/conversion', ctrl.conversionReport);
router.get('/pending-followups', ctrl.pendingFollowupsReport);
router.get('/charging-repair', ctrl.chargingRepairReport);
router.get('/fleet-depletion', ctrl.fleetDepletionReport);
router.get('/lost-reasons', ctrl.lostReasonReport);

module.exports = router;
