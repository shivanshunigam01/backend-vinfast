/** Walk-in vs digital classification used across MIS conversion formulas. */
const WALK_IN_SOURCES = new Set([
  'Walk-in',
  'Walk-In',
  'Walk in',
  'Executive',
  'Tele-In',
  'Tele-Out',
  'Event / BTL',
  'Outdoor Activity',
  'Management Referral',
  'Employee Referral',
  'Existing Customer Referral',
]);

function isWalkInSource(source) {
  const s = String(source || '').trim();
  if (!s) return false;
  if (WALK_IN_SOURCES.has(s)) return true;
  return /^walk[\s-]?in$/i.test(s);
}

function isDigitalSource(source) {
  return !isWalkInSource(source);
}

/** Percent with two decimals. Denominator 0 → 0.00 (never DIV/0). */
function safePct(numerator, denominator) {
  const n = Number(numerator) || 0;
  const d = Number(denominator) || 0;
  if (d <= 0) return 0;
  return Math.round((n / d) * 10000) / 100;
}

function formatPct(numerator, denominator) {
  return safePct(numerator, denominator).toFixed(2);
}

function leadAgeInDays(createdAt, now = new Date()) {
  if (!createdAt) return 0;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return 0;
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - start) / (24 * 60 * 60 * 1000)));
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

module.exports = {
  WALK_IN_SOURCES,
  isWalkInSource,
  isDigitalSource,
  safePct,
  formatPct,
  leadAgeInDays,
  startOfDay,
  endOfDay,
  startOfMonth,
};
