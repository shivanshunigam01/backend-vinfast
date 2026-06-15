require('../../models/tdModels');

const router = require('express').Router();
const validate = require('../../middleware/validate');
const tdUsersController = require('../../controllers/tdUsersController');
const { mongoIdParam } = require('../../validators/adminValidators');

router.get('/', tdUsersController.listUsers);
router.post('/', tdUsersController.createUser);
router.put('/:id', mongoIdParam, validate, tdUsersController.updateUser);
router.patch('/:id', mongoIdParam, validate, tdUsersController.patchUser);

module.exports = router;
