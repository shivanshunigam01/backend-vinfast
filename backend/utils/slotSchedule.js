const { normalizeTimeTo24h } = require('./timeFormat');

function toMinutes(timeStr) {
  const normalized = normalizeTimeTo24h(timeStr);
  if (!normalized) return 0;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateSlotTimesFromRules({
  workingStartTime = '10:00',
  workingEndTime = '18:00',
  slotDuration = 30,
  bufferTime = 15
}) {
  const times = [];
  let current = toMinutes(workingStartTime);
  const end = toMinutes(workingEndTime);
  while (current + slotDuration <= end) {
    times.push(toTimeStr(current));
    current += slotDuration + bufferTime;
  }
  return times;
}

function normalizeSlotTimesList(times) {
  if (!Array.isArray(times)) return [];
  return [...new Set(times.map((t) => normalizeTimeTo24h(t)).filter(Boolean))].sort(
    (a, b) => toMinutes(a) - toMinutes(b)
  );
}

/** Admin-defined slotTimes, or auto-generated from duration/buffer rules. */
function resolveConfiguredSlotTimes(config = {}) {
  const custom = normalizeSlotTimesList(config.slotTimes);
  if (custom.length > 0) return custom;
  return generateSlotTimesFromRules(config);
}

module.exports = {
  generateSlotTimesFromRules,
  normalizeSlotTimesList,
  resolveConfiguredSlotTimes,
  toMinutes,
  toTimeStr
};
