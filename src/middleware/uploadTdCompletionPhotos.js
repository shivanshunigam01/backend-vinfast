const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('Only image files are allowed for test drive completion photos'));
      return;
    }
    cb(null, true);
  },
});

/** Accepts `customerPhoto` (required at completion) and `vehiclePhoto` (optional). */
module.exports = upload.fields([
  { name: 'customerPhoto', maxCount: 1 },
  { name: 'vehiclePhoto', maxCount: 1 },
]);
