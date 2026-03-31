const express = require('express');
const controller = require('../controllers/leadController');
const validate = require('../middleware/validate');
const { publicLeadValidation } = require('../utils/validators');

const router = express.Router();
router.post('/', validate(publicLeadValidation), controller.createLead);
module.exports = router;
