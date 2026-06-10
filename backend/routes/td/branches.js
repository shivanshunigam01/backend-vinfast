const express = require('express');
const ctrl = require('../../controllers/branchController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getBranches);
router.get('/:id', ctrl.getBranchById);
router.post('/', authorize('superadmin', 'manager'), ctrl.createBranch);
router.put('/:id', authorize('superadmin', 'manager'), ctrl.updateBranch);
router.delete('/:id', authorize('superadmin'), ctrl.deleteBranch);

module.exports = router;
