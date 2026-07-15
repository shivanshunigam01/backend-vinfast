const { body } = require('express-validator');
const { RATING_FIELDS } = require('../models/PostDeliveryFeedback');

exports.postDeliveryFeedbackValidator = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('mobile')
    .matches(/^\d{10}$/)
    .withMessage('A valid 10-digit mobile number is required'),
  body('deliveryDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Invalid delivery date'),
  body('ratings').isObject().withMessage('Ratings are required'),
  ...RATING_FIELDS.map((field) =>
    body(`ratings.${field}`)
      .isInt({ min: 1, max: 5 })
      .withMessage(`Rating "${field}" must be an integer from 1 to 5`)
  ),
];
