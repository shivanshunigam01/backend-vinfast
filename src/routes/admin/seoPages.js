const router = require('express').Router();
const validate = require('../../middleware/validate');
const { authorize } = require('../../middleware/auth');
const seoAdminController = require('../../controllers/seoAdminController');
const { mongoIdParam } = require('../../validators/adminValidators');
const { districtPageUpdateValidator } = require('../../validators/seoValidators');

router.get('/district-pages', seoAdminController.listDistrictPages);
router.post(
  '/district-pages/regenerate',
  authorize('superadmin', 'manager'),
  seoAdminController.regenerateDistrictPages
);
router.get('/district-pages/:id', mongoIdParam, validate, seoAdminController.getDistrictPage);
router.put(
  '/district-pages/:id',
  authorize('superadmin', 'manager'),
  mongoIdParam,
  districtPageUpdateValidator,
  validate,
  seoAdminController.updateDistrictPage
);

module.exports = router;
