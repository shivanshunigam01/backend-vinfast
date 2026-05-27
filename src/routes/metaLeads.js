const router = require('express').Router();
const { metaLeadsLimiter } = require('../middleware/rateLimiter');
const metaLeadsController = require('../controllers/metaLeadsController');

/** All paths are public — no JWT. */
router.get('/public/All_leads', metaLeadsLimiter, metaLeadsController.getAllMetaLeads);
router.get('/meta-leads', metaLeadsLimiter, metaLeadsController.getAllMetaLeads);

module.exports = router;
