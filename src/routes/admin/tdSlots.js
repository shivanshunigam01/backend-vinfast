require('../../models/tdModels');

const router = require('express').Router();
const tdSlotsController = require('../../controllers/tdSlotsController');

router.get('/', tdSlotsController.listConfigs);
router.get('/available', tdSlotsController.availableSlots);
router.post('/config', tdSlotsController.saveConfig);
router.post('/date-overrides', tdSlotsController.saveDateOverrides);
router.post('/block-date', tdSlotsController.blockDate);
router.post('/unblock-date', tdSlotsController.unblockDate);

module.exports = router;
