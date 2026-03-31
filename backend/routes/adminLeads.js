const express = require('express');
const controller = require('../controllers/leadController');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { adminLeadUpdateValidation, objectIdParam, searchQueryValidation } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/', validate(searchQueryValidation), controller.getLeads);
router.get('/:id', validate([objectIdParam()]), controller.getLeadById);
router.put('/:id', validate(adminLeadUpdateValidation), controller.updateLead);
router.delete('/:id', validate([objectIdParam()]), authorize('superadmin'), controller.deleteLead);

module.exports = router;
