const express = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLoginValidation } = require('../utils/validators');

const router = express.Router();

router.post('/login', validate(authLoginValidation), controller.login);
router.get('/me', protect, controller.me);

module.exports = router;
