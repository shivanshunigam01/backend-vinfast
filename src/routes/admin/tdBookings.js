require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const uploadDlImage = require('../../middleware/uploadDlImage');
const tdBookingsController = require('../../controllers/tdBookingsController');
const { mongoIdParam } = require('../../validators/adminValidators');

/** Static paths must be registered before /:id */
router.get('/executives/list', tdBookingsController.listExecutives);
router.get('/eligibility', tdBookingsController.checkBookingEligibility);
router.get('/approvals/pending', tdBookingsController.listPendingApprovals);
router.get('/my', tdBookingsController.listMyBookings);
router.get('/', tdBookingsController.listBookings);
router.post('/', tdBookingsController.createBookingByStaff);
router.patch('/:id/approval', mongoIdParam, validate, tdBookingsController.decideRepeatApproval);
router.get('/:id', mongoIdParam, validate, tdBookingsController.getBooking);
router.patch('/:id/details', mongoIdParam, validate, tdBookingsController.updateBookingDetails);
router.patch('/:id/cancel', mongoIdParam, validate, tdBookingsController.cancelBooking);
router.delete('/:id', mongoIdParam, validate, tdBookingsController.deleteBooking);
router.patch('/:id/assign-executive', mongoIdParam, validate, tdBookingsController.assignExecutive);
router.patch('/:id/assign-vehicle', mongoIdParam, validate, tdBookingsController.assignVehicle);
router.patch('/:id/reschedule', mongoIdParam, validate, tdBookingsController.rescheduleBooking);
router.post(
  '/:id/verify-dl',
  mongoIdParam,
  validate,
  uploadDlImage.single('dlImage'),
  tdBookingsController.verifyDrivingLicence,
);
router.patch('/:id', mongoIdParam, validate, tdBookingsController.updateBooking);

module.exports = router;
