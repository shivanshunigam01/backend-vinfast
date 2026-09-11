const { body } = require('express-validator');
const {
  enquiryInterests,
  productModels,
  testDrivePreferredLocations,
  yesNo,
  purchaseTimelines,
} = require('../constants/enums');
const { isValidLeadModel } = require('../utils/leadModel');
const { getActiveModelNames } = require('../utils/vehicleCatalog');

const mobileRule = body('mobile')
  .matches(/^[6-9]\d{9}$/)
  .withMessage('Invalid mobile');

exports.leadValidator = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  mobileRule,
  body('model')
    .custom((value) => {
      if (!isValidLeadModel(value)) {
        throw new Error(`Model must be one of: ${productModels.join(', ')} or a valid trim label`);
      }
      return true;
    }),
  body('interestedModels')
    .optional({ values: 'null' })
    .custom(async (value) => {
      if (value == null || value === '') return true;
      const list = Array.isArray(value) ? value : [value];
      const models = await getActiveModelNames();
      for (const raw of list) {
        const name = String(raw || '').trim();
        if (!name) continue;
        if (!isValidLeadModel(name) && !models.includes(name)) {
          throw new Error(`interestedModels must be valid product names (got "${name}")`);
        }
      }
      return true;
    }),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('otherCity').custom((value, { req }) => {
    if (req.body.city === 'Other' && !String(value || '').trim()) {
      throw new Error('otherCity is required when city is Other');
    }
    return true;
  }),
];

exports.testDriveValidator = [
  body('customerName').trim().isLength({ min: 2 }).withMessage('Customer name is required'),
  mobileRule,
  body('model').custom(async (value, { req }) => {
    // Accept either a single model or models[] (multi-product test drive).
    const list = [
      ...new Set(
        [
          ...(Array.isArray(req.body?.models) ? req.body.models : []),
          value,
        ]
          .map((m) => String(m || '').trim())
          .filter(Boolean),
      ),
    ];
    if (!list.length) {
      throw new Error('Model is required');
    }
    const models = await getActiveModelNames();
    for (const name of list) {
      if (!models.includes(name)) {
        throw new Error(`Model must be one of: ${models.join(', ')}`);
      }
    }
    return true;
  }),
  body('models')
    .optional({ values: 'null' })
    .custom(async (value) => {
      if (value == null || value === '') return true;
      const list = Array.isArray(value) ? value : [value];
      const models = await getActiveModelNames();
      for (const raw of list) {
        const name = String(raw || '').trim();
        if (!name) continue;
        if (!models.includes(name)) {
          throw new Error(`models must be one of: ${models.join(', ')}`);
        }
      }
      return true;
    }),
  body('interestedModels')
    .optional({ values: 'null' })
    .custom(async (value) => {
      if (value == null || value === '') return true;
      const list = Array.isArray(value) ? value : [value];
      const models = await getActiveModelNames();
      for (const raw of list) {
        const name = String(raw || '').trim();
        if (!name) continue;
        if (!models.includes(name)) {
          throw new Error(`interestedModels must be one of: ${models.join(', ')}`);
        }
      }
      return true;
    }),
  body('preferredDate').isISO8601().withMessage('Preferred date is required'),
  body('preferredTestDriveLocation')
    .optional({ values: 'null' })
    .isIn(testDrivePreferredLocations)
    .withMessage(`Location must be one of: ${testDrivePreferredLocations.join(', ')}`),
  body('ownsCar')
    .optional({ values: 'null' })
    .isIn(yesNo)
    .withMessage('ownsCar must be Yes or No'),
  body('currentCarDetails')
    .optional({ values: 'null' })
    .trim()
    .custom((value, { req }) => {
      if (req.body.ownsCar === 'Yes' && !String(value || '').trim()) {
        throw new Error('Current car (model/brand) is required when you own a car');
      }
      return true;
    }),
  body('purchaseTimeline')
    .optional({ values: 'null' })
    .isIn(purchaseTimelines)
    .withMessage(`purchaseTimeline must be one of: ${purchaseTimelines.join(', ')}`),
];

exports.enquiryValidator = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  mobileRule,
  body('interest')
    .optional()
    .isIn(enquiryInterests)
    .withMessage('Invalid interest type'),
];
