const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerBookingController');
const { customerProtect } = require('../middleware/customerAuth');

router.use(customerProtect);

router.get('/', ctrl.getMyBookings);
router.get('/:id', ctrl.getBookingById);
router.patch('/:id/reschedule', ctrl.rescheduleBooking);

module.exports = router;
