const multer = require('multer');
const ApiError = require('../utils/apiError');

const storage = multer.memoryStorage();

const uploadCrmLeadImport = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const ok =
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      name.endsWith('.csv') ||
      [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/csv',
      ].includes(file.mimetype);
    if (!ok) {
      return cb(new ApiError(400, 'Upload an Excel (.xlsx) or CSV file'));
    }
    cb(null, true);
  },
}).single('file');

module.exports = uploadCrmLeadImport;
