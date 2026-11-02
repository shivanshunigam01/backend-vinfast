const multer = require('multer');
const ApiError = require('../utils/apiError');

const upload = multer({
  storage: multer.memoryStorage(),
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
