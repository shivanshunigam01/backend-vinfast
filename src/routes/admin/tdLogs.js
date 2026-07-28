require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdLogsController = require('../../controllers/tdLogsController');
const uploadTdCompletionPhotos = require('../../middleware/uploadTdCompletionPhotos');
const { mongoIdParam } = require('../../validators/adminValidators');
const { requireAnyModuleAction } = require('../../utils/modulePermissions');

/** Static paths must be registered before /:id */
router.get(
  '/',
  requireAnyModuleAction([
    ['td_bookings', 'view'],
    ['td_my_bookings', 'view'],
  ]),
  tdLogsController.listLogs,
);
router.post(
  '/start',
  requireAnyModuleAction([
    ['td_bookings', 'start_drive'],
    ['td_my_bookings', 'start_drive'],
  ]),
  tdLogsController.startTestDrive,
);
router.get(
  '/:id',
  mongoIdParam,
  validate,
  requireAnyModuleAction([
    ['td_bookings', 'view'],
    ['td_my_bookings', 'view'],
  ]),
  tdLogsController.getLog,
);
router.patch(
  '/:logId/end',
  requireAnyModuleAction([
    ['td_bookings', 'start_drive'],
    ['td_my_bookings', 'complete'],
  ]),
  uploadTdCompletionPhotos,
  tdLogsController.endTestDrive,
);
router.patch(
  '/:logId/completion-media',
  requireAnyModuleAction([
    ['td_bookings', 'start_drive'],
    ['td_my_bookings', 'complete'],
  ]),
  uploadTdCompletionPhotos,
  tdLogsController.updateCompletionMedia,
);
router.patch(
  '/:logId/gps',
  requireAnyModuleAction([
    ['td_bookings', 'start_drive'],
    ['td_my_bookings', 'start_drive'],
  ]),
  tdLogsController.updateGpsRoute,
);

module.exports = router;
