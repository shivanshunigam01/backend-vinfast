require('../models/tdModels');

const router = require('express').Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const tdFeedbackController = require('../controllers/tdFeedbackController');
const { param } = require('express-validator');

const bookingIdParam = [param('bookingId').isMongoId().withMessage('Invalid booking id')];

/** Admin panel uses /api/v1/td/feedback/* (mirrors nested backend mount). */
router.post('/submit', protect, tdFeedbackController.submitFeedback);
router.get('/booking/:bookingId', protect, bookingIdParam, validate, tdFeedbackController.getByBooking);

module.exports = router;
