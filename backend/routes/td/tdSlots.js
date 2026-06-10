const express = require('express');
const ctrl = require('../../controllers/tdSlotController');

const router = express.Router();

router.get('/available', ctrl.getAvailableSlots);
router.post('/check', ctrl.checkSlot);

module.exports = router;
