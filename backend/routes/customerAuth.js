const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerAuthController');
const { customerProtect } = require('../middleware/customerAuth');

router.post('/check-mobile', ctrl.checkMobile);
router.post('/login', ctrl.login);
router.get('/me', customerProtect, ctrl.me);

module.exports = router;
