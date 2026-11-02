const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/apiError');
const { MODEL_PAGE_SLUGS } = require('../models/ModelPageContent');
const { modelPageUploadDir } = require('../utils/uploadPaths');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function assertSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!MODEL_PAGE_SLUGS.includes(s)) {
    throw new ApiError(400, `Invalid model page slug. Allowed: ${MODEL_PAGE_SLUGS.join(', ')}`);
  }
  return s;
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      const slug = assertSlug(req.params.slug);
      cb(null, modelPageUploadDir(slug));
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new ApiError(400, 'Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
