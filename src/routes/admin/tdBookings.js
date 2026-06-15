const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdBookingsController = require('../../controllers/tdBookingsController');
const { mongoIdParam } = require('../../validators/adminValidators');

/** Static paths must be registered before /:id */
router.get('/executives/list', tdBookingsController.listExecutives);
router.get('/my', tdBookingsController.listMyBookings);
router.get('/', tdBookingsController.listBookings);
router.get('/:id', mongoIdParam, validate, tdBookingsController.getBooking);
router.patch('/:id/cancel', mongoIdParam, validate, tdBookingsController.cancelBooking);
router.patch('/:id/assign-executive', mongoIdParam, validate, tdBookingsController.assignExecutive);
router.patch('/:id/reschedule', mongoIdParam, validate, tdBookingsController.rescheduleBooking);
router.patch('/:id', mongoIdParam, validate, tdBookingsController.updateBooking);

module.exports = router;
