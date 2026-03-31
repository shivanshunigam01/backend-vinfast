const express = require('express');
const controller = require('../controllers/testDriveController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { adminTestDriveUpdateValidation, objectIdParam, searchQueryValidation } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/', validate(searchQueryValidation), controller.getTestDrives);
router.get('/:id', validate([objectIdParam()]), controller.getTestDriveById);
router.put('/:id', validate(adminTestDriveUpdateValidation), controller.updateTestDrive);
router.delete('/:id', validate([objectIdParam()]), controller.deleteTestDrive);

module.exports = router;
