const express = require('express');
const controller = require('../controllers/enquiryController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { adminEnquiryUpdateValidation, objectIdParam, searchQueryValidation } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.get('/', validate(searchQueryValidation), controller.getEnquiries);
router.get('/:id', validate([objectIdParam()]), controller.getEnquiryById);
router.put('/:id', validate(adminEnquiryUpdateValidation), controller.updateEnquiry);
router.delete('/:id', validate([objectIdParam()]), controller.deleteEnquiry);

module.exports = router;
