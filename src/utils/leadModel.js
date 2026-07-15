const { productModels } = require('../constants/enums');
const { getModelNamesSync } = require('./vehicleCatalog');

const BOTH_LABELS = new Set(['Both', 'VF 6 / VF 7', 'VF 6 / VF 7 / VF MPV 7']);

/**
 * Model names from the admin-managed master catalog (cached), longest first so
 * prefix checks match "VF MPV 7" before "VF 7".
 */
function variantPrefixes() {
  return [...getModelNamesSync()].sort((a, b) => b.length - a.length);
}

function isValidLeadModel(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;

  const prefixes = variantPrefixes();
  const baseFromDash = s.split(' — ')[0].trim();
  if (prefixes.includes(baseFromDash) || productModels.includes(baseFromDash)) return true;
  if (BOTH_LABELS.has(s)) return true;

  return prefixes.some((prefix) => s === prefix || s.startsWith(`${prefix} `));
}

function normalizeLeadModelForStorage(raw) {
  const s = String(raw || '').trim();
  if (BOTH_LABELS.has(s)) return 'Both';
  return s;
}

function baseProductModel(raw) {
  const s = String(raw || '').trim();
  if (BOTH_LABELS.has(s)) return 'Both';
  for (const prefix of variantPrefixes()) {
    if (s === prefix || s.startsWith(`${prefix} `)) return prefix;
  }
  return s;
}

module.exports = {
  isValidLeadModel,
  normalizeLeadModelForStorage,
  baseProductModel,
  BOTH_LABELS,
};
