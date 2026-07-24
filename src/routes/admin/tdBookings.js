require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const uploadDlImage = require('../../middleware/uploadDlImage');
const tdBookingsController = require('../../controllers/tdBookingsController');
const tdRescheduleController = require('../../controllers/tdRescheduleController');
const { mongoIdParam } = require('../../validators/adminValidators');

/** Static paths must be registered before /:id */
router.get('/executives/list', tdBookingsController.listExecutives);
router.get('/eligibility', tdBookingsController.checkBookingEligibility);
router.get('/approvals/pending', tdBookingsController.listPendingApprovals);
router.get('/reschedule/pending', tdRescheduleController.listPendingReschedules);
router.get('/reschedule/history', tdRescheduleController.listRescheduleHistory);
router.patch('/reschedule/:id/decide', mongoIdParam, validate, tdRescheduleController.decideReschedule);
router.get('/my', tdBookingsController.listMyBookings);
router.get('/', tdBookingsController.listBookings);
router.post('/', tdBookingsController.createBookingByStaff);
router.patch('/:id/approval', mongoIdParam, validate, tdBookingsController.decideRepeatApproval);
router.get('/:id', mongoIdParam, validate, tdBookingsController.getBooking);
router.patch('/:id/details', mongoIdParam, validate, tdBookingsController.updateBookingDetails);
router.patch('/:id/cancel', mongoIdParam, validate, tdBookingsController.cancelBooking);
router.delete('/:id', mongoIdParam, validate, tdBookingsController.deleteBooking);
router.patch('/:id/assign-executive', mongoIdParam, validate, tdBookingsController.assignExecutive);
router.patch('/:id/accept-assignment', mongoIdParam, validate, tdBookingsController.acceptAssignment);
router.patch('/:id/reject-assignment', mongoIdParam, validate, tdBookingsController.rejectAssignment);
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
