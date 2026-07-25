require('../../models/tdModels');

const router = require('express').Router();
const tdSlotsController = require('../../controllers/tdSlotsController');
const { requireModuleAction, requireAnyModuleAction } = require('../../utils/modulePermissions');

router.get('/', requireModuleAction('td_config', 'view'), tdSlotsController.listConfigs);
/** Slot picker used by bookings / my-bookings / new booking — not only Slot Config. */
router.get(
  '/available',
  requireAnyModuleAction([
    ['td_config', 'view'],
    ['td_bookings', 'view'],
    ['td_bookings', 'create'],
    ['td_bookings', 'reschedule_approve'],
    ['td_my_bookings', 'view'],
    ['td_my_bookings', 'reschedule'],
  ]),
  tdSlotsController.availableSlots,
);
router.post('/config', requireModuleAction('td_config', 'update'), tdSlotsController.saveConfig);
router.post(
  '/date-overrides',
  requireModuleAction('td_config', 'update'),
  tdSlotsController.saveDateOverrides,
);
router.post('/block-date', requireModuleAction('td_config', 'update'), tdSlotsController.blockDate);
router.post('/unblock-date', requireModuleAction('td_config', 'update'), tdSlotsController.unblockDate);

module.exports = router;
