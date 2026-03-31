const express = require('express');
const controller = require('../controllers/testDriveController');
const validate = require('../middleware/validate');
const { publicTestDriveValidation } = require('../utils/validators');

const router = express.Router();
router.post('/', validate(publicTestDriveValidation), controller.createTestDrive);
module.exports = router;
