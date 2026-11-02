const fs = require('fs');
const path = require('path');

function getUploadRoot() {
  const fromEnv = process.env.UPLOAD_DIR && String(process.env.UPLOAD_DIR).trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(__dirname, '../../uploads');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function modelPageUploadDir(slug) {
  return ensureDir(path.join(getUploadRoot(), 'model-pages', slug));
}

function publicRequestOrigin(req) {
  const configured = process.env.PUBLIC_API_ORIGIN && String(process.env.PUBLIC_API_ORIGIN).trim();
  if (configured) return configured.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`.replace(/\/$/, '');
}

module.exports = {
  getUploadRoot,
  ensureDir,
  modelPageUploadDir,
  publicRequestOrigin,
};
