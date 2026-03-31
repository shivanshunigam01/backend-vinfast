const express = require('express');
const controller = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.get('/stats', protect, controller.getStats);
module.exports = router;
