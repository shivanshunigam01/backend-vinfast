const VehicleModel = require('../models/VehicleModel');

/**
 * Seed catalog — mirrors the lineup that was previously hardcoded across the
 * app. Inserted once when the master collection is empty.
 */
const DEFAULT_CATALOG = [
  { name: 'VF 7', displayOrder: 1, variants: ['Sky Infinity', 'Sky', 'Wind Infinity', 'Wind', 'Earth'] },
  { name: 'VF 6', displayOrder: 2, variants: ['Wind Infinity', 'Wind', 'Earth'] },
  { name: 'VF MPV 7', displayOrder: 3, variants: [] },
  { name: 'Limo Green', displayOrder: 4, variants: [] },
];

const FALLBACK_MODEL_NAMES = DEFAULT_CATALOG.map((m) => m.name);

const CACHE_TTL_MS = 60 * 1000;
let cache = { names: FALLBACK_MODEL_NAMES, loadedAt: 0 };
let refreshing = null;

async function ensureVehicleCatalog() {
  const count = await VehicleModel.estimatedDocumentCount();
  if (count > 0) return;
  await VehicleModel.insertMany(
    DEFAULT_CATALOG.map((m) => ({
      name: m.name,
      displayOrder: m.displayOrder,
      active: true,
      variants: m.variants.map((v, i) => ({ name: v, active: true, displayOrder: i + 1 })),
    })),
  );
}

async function refreshModelNameCache() {
  await ensureVehicleCatalog();
  const docs = await VehicleModel.find({ active: true }).select('name').lean();
  cache = {
    names: docs.length ? docs.map((d) => d.name) : FALLBACK_MODEL_NAMES,
    loadedAt: Date.now(),
  };
  return cache.names;
}

/** Active model names, refreshed from the DB when the cache is stale. */
async function getActiveModelNames() {
  if (Date.now() - cache.loadedAt > CACHE_TTL_MS) {
    try {
      await refreshModelNameCache();
    } catch {
      cache.loadedAt = Date.now(); // avoid hammering the DB when it's down
    }
  }
  return cache.names;
}

/**
 * Sync accessor for code paths that cannot await (mongoose sync validators,
 * express-validator sync customs). Returns the cached list and kicks off a
 * background refresh when stale.
 */
function getModelNamesSync() {
  if (Date.now() - cache.loadedAt > CACHE_TTL_MS && !refreshing) {
    refreshing = refreshModelNameCache()
      .catch(() => {
        cache.loadedAt = Date.now();
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return cache.names;
}

/** Call after any admin write to the catalog so validation picks it up immediately. */
function invalidateVehicleCatalogCache() {
  cache = { ...cache, loadedAt: 0 };
}

module.exports = {
  DEFAULT_CATALOG,
  FALLBACK_MODEL_NAMES,
  ensureVehicleCatalog,
  getActiveModelNames,
  getModelNamesSync,
  invalidateVehicleCatalogCache,
};
