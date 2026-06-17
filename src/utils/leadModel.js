const { productModels } = require('../constants/enums');

const BOTH_LABELS = new Set(['Both', 'VF 6 / VF 7', 'VF 6 / VF 7 / VF MPV 7']);
const VARIANT_PREFIXES = ['VF 6', 'VF 7', 'VF MPV 7'];

function isValidLeadModel(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;

  const baseFromDash = s.split(' — ')[0].trim();
  if (productModels.includes(baseFromDash)) return true;
  if (BOTH_LABELS.has(s)) return true;

  return VARIANT_PREFIXES.some((prefix) => s === prefix || s.startsWith(`${prefix} `));
}

function normalizeLeadModelForStorage(raw) {
  const s = String(raw || '').trim();
  if (BOTH_LABELS.has(s)) return 'Both';
  return s;
}

function baseProductModel(raw) {
  const s = String(raw || '').trim();
  if (productModels.includes(s)) return s;
  if (BOTH_LABELS.has(s)) return 'Both';
  if (s.startsWith('VF MPV 7')) return 'VF MPV 7';
  if (s.startsWith('VF 6')) return 'VF 6';
  if (s.startsWith('VF 7')) return 'VF 7';
  return s;
}

module.exports = {
  isValidLeadModel,
  normalizeLeadModelForStorage,
  baseProductModel,
  BOTH_LABELS,
  VARIANT_PREFIXES,
};
