require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const uploadDlImage = require('../../middleware/uploadDlImage');
const tdBookingsController = require('../../controllers/tdBookingsController');
const tdRescheduleController = require('../../controllers/tdRescheduleController');
const { mongoIdParam } = require('../../validators/adminValidators');
const {
  requireModuleAction,
  requireModuleActionOrRoles,
  requireAnyModuleAction,
} = require('../../utils/modulePermissions');

/** Static paths must be registered before /:id */
router.get('/executives/list', tdBookingsController.listExecutives);
router.get('/eligibility', tdBookingsController.checkBookingEligibility);
router.get('/approvals/pending', tdBookingsController.listPendingApprovals);
router.post(
  '/bulk-delete',
  requireModuleActionOrRoles('td_bookings', 'update', 'superadmin', 'manager'),
  tdBookingsController.bulkDeleteBookings,
);
router.get('/reschedule/pending', tdRescheduleController.listPendingReschedules);
router.get(
  '/reschedule/history',
  requireAnyModuleAction([
    ['td_reschedule_history', 'view'],
    ['td_bookings', 'view'],
  ]),
  tdRescheduleController.listRescheduleHistory,
);
router.patch(
  '/reschedule/:id/decide',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_reschedule_history', 'approve'],
    ['td_bookings', 'reschedule_approve'],
  ]),
  tdRescheduleController.decideReschedule,
);
router.get(
  '/my',
  requireModuleAction('td_my_bookings', 'view'),
  tdBookingsController.listMyBookings,
);
router.get('/', requireModuleAction('td_bookings', 'view'), tdBookingsController.listBookings);
router.post(
  '/',
  requireModuleAction('td_bookings', 'create'),
  tdBookingsController.createBookingByStaff,
);
router.patch(
  '/:id/approval',
  mongoIdParam,
  validate,
  requireModuleAction('td_bookings', 'reschedule_approve'),
  tdBookingsController.decideRepeatApproval,
);
router.get(
  '/:id',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_bookings', 'view'],
    ['td_my_bookings', 'view'],
  ]),
  tdBookingsController.getBooking,
);
router.patch(
  '/:id/details',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_bookings', 'update', 'superadmin', 'manager'),
  tdBookingsController.updateBookingDetails,
);
router.patch(
  '/:id/cancel',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_bookings', 'cancel'],
    ['td_my_bookings', 'cancel'],
  ]),
  tdBookingsController.cancelBooking,
);
router.delete(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleActionOrRoles('td_bookings', 'update', 'superadmin', 'manager'),
  tdBookingsController.deleteBooking,
);
router.patch(
  '/:id/assign-executive',
  mongoIdParam,
  validate,
  requireModuleAction('td_bookings', 'assign'),
  tdBookingsController.assignExecutive,
);
router.patch(
  '/:id/accept-assignment',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_my_bookings', 'update'],
    ['td_bookings', 'update'],
  ]),
  tdBookingsController.acceptAssignment,
);
router.patch(
  '/:id/reject-assignment',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_my_bookings', 'update'],
    ['td_bookings', 'update'],
  ]),
  tdBookingsController.rejectAssignment,
);
router.patch(
  '/:id/assign-vehicle',
  mongoIdParam,
  validate,
  requireModuleAction('td_bookings', 'assign'),
  tdBookingsController.assignVehicle,
);
router.patch(
  '/:id/reschedule',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_bookings', 'reschedule_approve'],
    ['td_my_bookings', 'reschedule'],
  ]),
  tdBookingsController.rescheduleBooking,
);
router.post(
  '/:id/verify-dl',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_bookings', 'verify_dl'],
    ['td_my_bookings', 'verify_dl'],
  ]),
  uploadDlImage.single('dlImage'),
  tdBookingsController.verifyDrivingLicence,
);
router.patch(
  '/:id',
  mongoIdParam,
  validate,
  requireModuleAction('td_bookings', 'update'),
  tdBookingsController.updateBooking,
);

module.exports = router;
