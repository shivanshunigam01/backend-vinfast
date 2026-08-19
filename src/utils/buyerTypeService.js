const BuyerType = require('../models/BuyerType');

const DEFAULT_BUYER_TYPES = [
  { key: 'individual', label: 'Individual', order: 1, systemProtected: true },
  { key: 'corporate', label: 'Corporate', order: 2, systemProtected: true },
  { key: 'government', label: 'Government', order: 3, systemProtected: false },
  { key: 'other', label: 'Other', order: 4, systemProtected: false },
];

let cache = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

function invalidateBuyerTypeCache() {
  cache = null;
  cacheAt = 0;
}

async function ensureDefaultBuyerTypes() {
  const count = await BuyerType.countDocuments();
  if (count > 0) return;
  await BuyerType.insertMany(
    DEFAULT_BUYER_TYPES.map((row) => ({ ...row, active: true })),
  );
  invalidateBuyerTypeCache();
}

async function listBuyerTypes({ includeInactive = false } = {}) {
  await ensureDefaultBuyerTypes();
  const query = includeInactive ? {} : { active: true };
  return BuyerType.find(query).sort({ order: 1, label: 1 }).lean();
}

async function getActiveBuyerTypeLabels() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;
  const docs = await listBuyerTypes({ includeInactive: false });
  cache = docs.map((d) => d.label);
  cacheAt = now;
  return cache;
}

function slugifyKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = {
  DEFAULT_BUYER_TYPES,
  ensureDefaultBuyerTypes,
  listBuyerTypes,
  getActiveBuyerTypeLabels,
  invalidateBuyerTypeCache,
  slugifyKey,
};
