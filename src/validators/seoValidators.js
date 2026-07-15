const { body } = require('express-validator');

exports.districtPageUpdateValidator = [
  body('metaTitle').optional().isString().trim().isLength({ max: 200 }).withMessage('metaTitle too long'),
  body('metaDescription').optional().isString().trim().isLength({ max: 400 }).withMessage('metaDescription too long'),
  body('h1').optional().isString().trim().isLength({ max: 200 }).withMessage('h1 too long'),
  body('intro').optional().isString().trim(),
  body('sections').optional().isArray().withMessage('sections must be an array'),
  body('sections.*.heading').optional().isString().trim(),
  body('sections.*.body').optional().isString().trim(),
  body('keywords').optional().isArray().withMessage('keywords must be an array'),
  body('keywords.*').optional().isString().trim(),
  body('faqs').optional().isArray().withMessage('faqs must be an array'),
  body('faqs.*.question').optional().isString().trim().notEmpty().withMessage('FAQ question required'),
  body('faqs.*.answer').optional().isString().trim().notEmpty().withMessage('FAQ answer required'),
  body('active').optional().isBoolean().withMessage('active must be boolean'),
  body('customized').optional().isBoolean().withMessage('customized must be boolean'),
];
