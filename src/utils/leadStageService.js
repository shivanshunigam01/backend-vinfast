const LeadStage = require('../models/LeadStage');
const {
  CRM_LEAD_STAGES,
  LEGACY_TO_CRM,
  normalizeStageLabel,
} = require('../constants/leadStages');

const DEFAULT_STAGE_META = {
  Enquiry: { key: 'enquiry', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300', systemProtected: true },
  Interested: { key: 'interested', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', systemProtected: false },
  'Test Drive Booked': {
    key: 'test_drive_booked',
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    systemProtected: true,
  },
  'Test Drive Completed': {
    key: 'test_drive_completed',
    color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    systemProtected: true,
  },
  Negotiation: { key: 'negotiation', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', systemProtected: false },
  Booking: { key: 'booking', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', systemProtected: true },
  Delivered: {
    key: 'delivered',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    systemProtected: true,
    isTerminal: true,
  },
  Lost: {
    key: 'lost',
    color: 'bg-red-500/15 text-red-700 dark:text-red-300',
    systemProtected: true,
    isLost: true,
    isTerminal: true,
  },
};

let cache = { labels: null, docs: null, at: 0 };
const CACHE_MS = 30_000;

function slugifyKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

function invalidateLeadStageCache() {
  cache = { labels: null, docs: null, at: 0 };
}

async function ensureDefaultLeadStages() {
  const count = await LeadStage.countDocuments();
  if (count > 0) return;

  const docs = CRM_LEAD_STAGES.map((label, order) => {
    const meta = DEFAULT_STAGE_META[label] || {};
    return {
      key: meta.key || slugifyKey(label),
      label,
      order,
      color: meta.color || 'bg-slate-500/15 text-slate-700',
      active: true,
      isTerminal: Boolean(meta.isTerminal),
      isLost: Boolean(meta.isLost),
      systemProtected: Boolean(meta.systemProtected),
    };
  });
  await LeadStage.insertMany(docs);
  invalidateLeadStageCache();
}

async function listLeadStages({ includeInactive = false } = {}) {
  await ensureDefaultLeadStages();
  const filter = includeInactive ? {} : { active: true };
  return LeadStage.find(filter).sort({ order: 1, label: 1 }).lean();
}

async function getActiveStageLabels() {
  const now = Date.now();
  if (cache.labels && now - cache.at < CACHE_MS) return cache.labels;
  const docs = await listLeadStages({ includeInactive: false });
  const labels = docs.map((d) => d.label);
  cache = { labels: labels.length ? labels : [...CRM_LEAD_STAGES], docs, at: now };
  return cache.labels;
}

async function getActiveStageDocs() {
  await getActiveStageLabels();
  return cache.docs || [];
}

async function isValidCrmStage(stage) {
  const label = normalizeStageLabel(stage);
  const labels = await getActiveStageLabels();
  return labels.includes(label) || labels.includes(stage);
}

async function assertValidCrmStage(stage) {
  const labels = await getActiveStageLabels();
  const normalized = normalizeStageLabel(stage);
  if (!labels.includes(normalized) && !labels.includes(stage)) {
    const err = new Error(`Invalid stage. Use one of: ${labels.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  return labels.includes(normalized) ? normalized : stage;
}

function stageIndex(labels, stage) {
  const n = normalizeStageLabel(stage);
  const i = labels.indexOf(n);
  return i >= 0 ? i : labels.indexOf(stage);
}

module.exports = {
  DEFAULT_STAGE_META,
  slugifyKey,
  invalidateLeadStageCache,
  ensureDefaultLeadStages,
  listLeadStages,
  getActiveStageLabels,
  getActiveStageDocs,
  isValidCrmStage,
  assertValidCrmStage,
  stageIndex,
  LEGACY_TO_CRM,
  normalizeStageLabel,
  CRM_LEAD_STAGES,
};
