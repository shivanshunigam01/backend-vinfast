const express = require('express');
const ctrl = require('../../controllers/tdFeedbackController');
const { protect } = require('../../middleware/auth');

const router = express.Router();

// Public: customer submits feedback (no auth required for simplicity)
router.post('/', ctrl.submitFeedback);

// Admin
router.get('/', protect, ctrl.getAllFeedback);
router.get('/stats', protect, ctrl.getFeedbackStats);

module.exports = router;
