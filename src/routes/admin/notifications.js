const router = require('express').Router();
const ctrl = require('../../controllers/notificationController');

router.get('/', ctrl.listNotifications);
router.patch('/:id/read', ctrl.markRead);
router.post('/read-all', ctrl.markAllRead);

module.exports = router;
