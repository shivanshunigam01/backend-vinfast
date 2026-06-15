require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdFeedbackController = require('../../controllers/tdFeedbackController');
const { param } = require('express-validator');

const bookingIdParam = [
  param('bookingId').isMongoId().withMessage('Invalid booking id'),
];

router.get('/booking/:bookingId', bookingIdParam, validate, tdFeedbackController.getByBooking);
router.post('/submit', tdFeedbackController.submitFeedback);

module.exports = router;
