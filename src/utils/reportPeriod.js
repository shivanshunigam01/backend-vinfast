/** Shared report period resolution for dashboards and delivery/lead reports. */

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC midnight shift). */
function parseDateKey(s) {
  const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekMonday(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfQuarter(d) {
  const x = startOfDay(d);
  const q = Math.floor(x.getMonth() / 3) * 3;
  x.setMonth(q, 1);
  return x;
}

function isFullCalendarYear(fromStr, toStr) {
  const a = String(fromStr || '').trim().match(/^(\d{4})-01-01$/);
  const b = String(toStr || '').trim().match(/^(\d{4})-12-31$/);
  return Boolean(a && b && a[1] === b[1]);
}

function rangeForPeriod(p, today, year) {
  let fromDate;
  let toDate = endOfDay(today);
  let period = p;

  if (p === 'daily') {
    fromDate = startOfDay(today);
  } else if (p === 'weekly') {
    fromDate = startOfWeekMonday(today);
  } else if (p === 'monthly') {
    fromDate = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
  } else if (p === 'quarterly') {
    fromDate = startOfQuarter(today);
  } else {
    const y = Number(year) || today.getFullYear();
    fromDate = startOfDay(new Date(y, 0, 1));
    toDate = endOfDay(new Date(y, 11, 31));
    period = 'yearly';
  }

  return { fromDate, toDate, period };
}

/**
 * Resolve from/to for a period preset relative to today when dates are omitted.
 *
 * - Known period + missing dates → compute from period
 * - Known non-yearly period + stale Jan 1–Dec 31 dates → recompute (fixes stuck year range)
 * - Otherwise explicit from/to win (manual custom range)
 * - year alone → full calendar year
 */
function resolvePeriodRange({ period, from, to, year } = {}) {
  const today = startOfDay(new Date());
  const rawPeriod = String(period || '').toLowerCase();
  const knownPeriod = PERIODS.includes(rawPeriod) ? rawPeriod : null;

  const fromStrIn = from ? String(from).trim() : '';
  const toStrIn = to ? String(to).trim() : '';
  const bothDates = Boolean(fromStrIn && toStrIn);
  const staleYearBounds =
    bothDates &&
    isFullCalendarYear(fromStrIn, toStrIn) &&
    knownPeriod &&
    knownPeriod !== 'yearly';

  let fromDate;
  let toDate;
  let p = knownPeriod || (bothDates ? 'monthly' : year ? 'yearly' : 'monthly');

  if (knownPeriod && (!bothDates || staleYearBounds)) {
    ({ fromDate, toDate, period: p } = rangeForPeriod(knownPeriod, today, year));
  } else if (fromStrIn || toStrIn) {
    fromDate = fromStrIn ? startOfDay(parseDateKey(fromStrIn)) : null;
    toDate = toStrIn ? endOfDay(parseDateKey(toStrIn)) : endOfDay(today);
    if (!fromDate) {
      if (p === 'daily') fromDate = startOfDay(toDate);
      else if (p === 'weekly') fromDate = startOfWeekMonday(toDate);
      else if (p === 'monthly') {
        fromDate = startOfDay(new Date(toDate.getFullYear(), toDate.getMonth(), 1));
      } else if (p === 'quarterly') fromDate = startOfQuarter(toDate);
      else fromDate = startOfDay(new Date(toDate.getFullYear(), 0, 1));
    }
  } else if (year) {
    const y = Number(year) || today.getFullYear();
    fromDate = startOfDay(new Date(y, 0, 1));
    toDate = endOfDay(new Date(y, 11, 31));
    p = 'yearly';
  } else {
    ({ fromDate, toDate, period: p } = rangeForPeriod('monthly', today, year));
  }

  return {
    period: p,
    from: toDateKey(fromDate),
    to: toDateKey(toDate),
    fromDate,
    toDate,
    year: fromDate.getFullYear(),
  };
}

/** Bucket granularity for time series: day | week | month */
function periodBucketUnit(period) {
  const p = String(period || '').toLowerCase();
  if (p === 'daily' || p === 'weekly') return 'day';
  if (p === 'monthly') return 'week';
  return 'month';
}

function periodBucketKey(date, period) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const unit = periodBucketUnit(period);
  if (unit === 'day') return toDateKey(d);
  if (unit === 'week') {
    const mon = startOfWeekMonday(d);
    return `W${toDateKey(mon)}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

module.exports = {
  PERIODS,
  resolvePeriodRange,
  periodBucketUnit,
  periodBucketKey,
  toDateKey,
  parseDateKey,
  startOfDay,
  endOfDay,
  isFullCalendarYear,
};
