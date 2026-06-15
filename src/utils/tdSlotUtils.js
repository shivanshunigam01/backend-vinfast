function toMinutes(timeStr) {
  const [h, m] = String(timeStr).split(':').map(Number);
  return h * 60 + (m || 0);
}

function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime12h(time24) {
  const [hStr, m] = time24.split(':');
  let h = parseInt(hStr, 10);
  const mer = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${mer}`;
}

function generateSlotTimesFromRules(opts) {
  const times = [];
  let current = toMinutes(opts.workingStartTime);
  const end = toMinutes(opts.workingEndTime);
  while (current + opts.slotDuration <= end) {
    times.push(toTimeStr(current));
    current += opts.slotDuration + opts.bufferTime;
  }
  return times;
}

function normalizeSlotTimesList(times) {
  const normalized = (times || [])
    .map((t) => {
      const trimmed = String(t).trim();
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(':');
        return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
      }
      return null;
    })
    .filter(Boolean);
  return [...new Set(normalized)].sort((a, b) => toMinutes(a) - toMinutes(b));
}

function isoDateOnly(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSlotPast(dateIso, time24) {
  const today = isoDateOnly(new Date());
  if (dateIso !== today) return dateIso < today;
  const now = new Date();
  const slotMins = toMinutes(time24);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return slotMins <= nowMins;
}

module.exports = {
  toMinutes,
  toTimeStr,
  formatTime12h,
  generateSlotTimesFromRules,
  normalizeSlotTimesList,
  isoDateOnly,
  isSlotPast,
};
