const { body, param } = require('express-validator');
const { adminRoles, resourceTypes, productModels } = require('../constants/enums');

const mobileRule = body('mobile')
  .matches(/^[6-9]\d{9}$/)
  .withMessage('Invalid mobile');

exports.mongoIdParam = [param('id').isMongoId().withMessage('Invalid id')];

exports.adminUserValidator = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').optional({ nullable: true }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(adminRoles).withMessage('Invalid admin role'),
];

exports.productValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('slug').trim().notEmpty().withMessage('Slug is required'),
];

exports.mediaValidator = [
  body('name').trim().notEmpty().withMessage('Media name is required'),
  body('url').trim().isURL().withMessage('Valid media url is required'),
  body('resourceType').optional().isIn(resourceTypes).withMessage('Invalid resource type'),
];

exports.slideReorderValidator = [
  body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array'),
];

exports.crmCreateLeadValidator = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  mobileRule,
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Valid email required').normalizeEmail(),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('otherCity').custom((value, { req }) => {
    if (req.body.city === 'Other' && !String(value || '').trim()) {
      throw new Error('otherCity is required when city is Other');
    }
    return true;
  }),
  body('model')
    .trim()
    .notEmpty()
    .withMessage('Model is required')
    .custom((value) => {
      const base = String(value).split(' — ')[0].trim();
      if (!productModels.includes(base)) {
        throw new Error(`Model must be one of: ${productModels.join(', ')}`);
      }
      return true;
    }),
  body('source').optional().trim(),
  body('remarks').optional().trim(),
  body('interest').optional().trim(),
  body('financeNeeded').optional().isBoolean(),
  body('exchangeNeeded').optional().isBoolean(),
  body('executiveId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid executive id'),
];
