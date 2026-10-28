/**
 * Startup seeds are opt-in only (env === "true") so deploy/restart never resets live data.
 * Demo TD fleet/staff require TD_DEMO_SEED=true — npm seed scripts set that.
 */

function isProduction() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function envBootstrapEnabled(varName) {
  return process.env[varName] === 'true';
}

function demoSeedEnabled() {
  return process.env.TD_DEMO_SEED === 'true';
}

module.exports = {
  isProduction,
  envBootstrapEnabled,
  demoSeedEnabled,
};
