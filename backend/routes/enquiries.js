const express = require('express');
const controller = require('../controllers/enquiryController');
const validate = require('../middleware/validate');
const { publicEnquiryValidation } = require('../utils/validators');

const router = express.Router();
router.post('/', validate(publicEnquiryValidation), controller.createEnquiry);
module.exports = router;
