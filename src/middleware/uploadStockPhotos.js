const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload.fields([
  { name: 'arrivalPhoto', maxCount: 1 },
  { name: 'vehiclePhotos', maxCount: 8 },
  { name: 'dashboardPhotos', maxCount: 4 },
  { name: 'issuePhotos', maxCount: 6 },
]);
