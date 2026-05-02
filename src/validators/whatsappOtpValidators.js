const { body } = require('express-validator');

exports.whatsappOtpSendValidator = [
  body('mobile')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Valid 10-digit Indian mobile is required'),
  body('name').optional().trim().isLength({ max: 120 }),
];

exports.whatsappOtpVerifyValidator = [
  body('mobile')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Valid 10-digit Indian mobile is required'),
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Enter the 6-digit code'),
];
