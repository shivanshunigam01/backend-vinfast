const express = require('express');
const ctrl = require('../../controllers/tdLogController');
const { protect } = require('../../middleware/auth');

const router = express.Router();
router.use(protect);

router.post('/start', ctrl.startTestDrive);
router.put('/:id/track', ctrl.addGpsPoint);
router.put('/:id/complete', ctrl.completeTestDrive);
router.get('/booking/:bookingId', ctrl.getLogByBooking);

module.exports = router;
