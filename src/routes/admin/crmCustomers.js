const router = require('express').Router();
const ctrl = require('../../controllers/crmCustomerController');

/** Customer master + full lifecycle history (/api/v1/admin/crm/customers) */
router.get('/lookup', ctrl.lookupCustomerByMobile);
router.get('/', ctrl.listCustomers);
router.get('/:id/history', ctrl.getCustomerHistory);

module.exports = router;
