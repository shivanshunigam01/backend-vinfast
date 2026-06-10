const express = require('express');
const ctrl = require('../../controllers/tdBookingController');
const { protect, authorize } = require('../../middleware/auth');
const { customerAuth } = require('./customers');

const router = express.Router();

// Customer facing: create booking (optional customer auth)
router.post('/', (req, res, next) => {
  // If token present, try customer auth; otherwise allow anonymous
  if (req.headers.authorization) {
    customerAuth(req, res, next);
  } else {
    next();
  }
}, ctrl.createBooking);

// Executive: see own bookings
router.get('/my', protect, ctrl.getExecutiveBookings);

// Admin: manage all bookings
router.get('/', protect, ctrl.getBookings);
router.get('/:id', protect, ctrl.getBookingById);
router.put('/:id/approve', protect, authorize('superadmin', 'manager'), ctrl.approveBooking);
router.put('/:id/assign-executive', protect, authorize('superadmin', 'manager'), ctrl.assignExecutive);
router.put('/:id/cancel', protect, ctrl.cancelBooking);
router.put('/:id/reschedule', protect, ctrl.rescheduleBooking);

module.exports = router;
