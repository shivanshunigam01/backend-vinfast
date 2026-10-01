/** Dealership wall-clock timezone (Bihar / India). */
const INDIA_TZ = 'Asia/Kolkata';

/**
 * Parse datetime from CRM forms / datetime-local (no offset) as India local time.
 * Full ISO strings with Z or offset are parsed normally.
 */
function parseUserDateTimeInput(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  const localDateTime = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (localDateTime) {
    const [, y, mo, d, hh, mm, ss = '00'] = localDateTime;
    const iso = `${y}-${mo}-${d}T${hh}:${mm}:${ss}+05:30`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    const parsed = new Date(`${y}-${mo}-${d}T00:00:00+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** HH:mm in India for calendar event labels (not server local / UTC). */
function formatWallClockIndia(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

/** YYYY-MM-DD in India (for report month buckets). */
function indiaDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: INDIA_TZ }).format(d);
}

/** Start/end of calendar month in India (IST wall clock). */
function monthBoundsIndia(now = new Date()) {
  const key = indiaDateKey(now);
  const [y, m] = key.split('-');
  const year = Number(y);
  const month = Number(m);
  const mtdStart = new Date(`${y}-${m}-01T00:00:00+05:30`);
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const nextStart = new Date(
    `${nextMonth.year}-${String(nextMonth.month).padStart(2, '0')}-01T00:00:00+05:30`,
  );
  const mtdMonthEnd = new Date(nextStart.getTime() - 1);
  return { mtdStart, mtdMonthEnd };
}

module.exports = {
  INDIA_TZ,
  parseUserDateTimeInput,
  formatWallClockIndia,
  indiaDateKey,
  monthBoundsIndia,
};
