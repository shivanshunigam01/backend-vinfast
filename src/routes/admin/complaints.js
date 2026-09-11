const router = require('express').Router();
const ctrl = require('../../controllers/complaintController');
const validate = require('../../middleware/validate');
const { mongoIdParam } = require('../../validators/adminValidators');
const { requireAnyModuleAction } = require('../../utils/modulePermissions');

const canView = requireAnyModuleAction([
  ['complaint_inbound', 'view'],
  ['complaint_outbound', 'view'],
  ['crm_leads', 'view'],
]);

const canCreate = requireAnyModuleAction([
  ['complaint_inbound', 'create'],
  ['complaint_outbound', 'create'],
  ['crm_leads', 'create'],
]);

const canUpdate = requireAnyModuleAction([
  ['complaint_inbound', 'update'],
  ['complaint_outbound', 'update'],
  ['crm_leads', 'update'],
]);

const canDelete = requireAnyModuleAction([
  ['complaint_inbound', 'delete'],
  ['complaint_outbound', 'delete'],
  ['crm_leads', 'delete'],
]);

router.get('/', canView, ctrl.listComplaints);
router.post('/', canCreate, ctrl.createComplaint);
router.get('/:id', mongoIdParam, validate, canView, ctrl.getComplaint);
router.put('/:id', mongoIdParam, validate, canUpdate, ctrl.updateComplaint);
router.post('/:id/communications', mongoIdParam, validate, canUpdate, ctrl.addCommunication);
router.delete('/:id', mongoIdParam, validate, canDelete, ctrl.deleteComplaint);

module.exports = router;
