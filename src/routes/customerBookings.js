const router = require('express').Router();
const validate = require('../middleware/validate');
const ctrl = require('../controllers/customerBookingController');
const { customerProtect } = require('../middleware/customerAuth');
const { mongoIdParam } = require('../validators/adminValidators');

router.use(customerProtect);

router.get('/', ctrl.getMyBookings);
router.get('/:id', mongoIdParam, validate, ctrl.getBookingById);
router.patch('/:id/reschedule', mongoIdParam, validate, ctrl.rescheduleBooking);
router.patch('/:id/location', mongoIdParam, validate, ctrl.updateLocation);

module.exports = router;
