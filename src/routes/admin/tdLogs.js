require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdLogsController = require('../../controllers/tdLogsController');
const { mongoIdParam } = require('../../validators/adminValidators');

/** Static paths must be registered before /:id */
router.get('/', tdLogsController.listLogs);
router.post('/start', tdLogsController.startTestDrive);
router.get('/:id', mongoIdParam, validate, tdLogsController.getLog);
router.patch('/:logId/end', tdLogsController.endTestDrive);
router.patch('/:logId/gps', tdLogsController.updateGpsRoute);

module.exports = router;
