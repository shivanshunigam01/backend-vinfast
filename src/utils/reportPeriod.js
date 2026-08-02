/** Shared report period resolution for dashboards and delivery/lead reports. */

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

/**
 * Resolve from/to for a period preset relative to today when dates are omitted.
 * Explicit from/to always win.
 */
function resolvePeriodRange({ period, from, to, year } = {}) {
  const today = startOfDay(new Date());
  let p = String(period || '').toLowerCase();
  if (!PERIODS.includes(p)) {
    if (from || to) p = 'custom';
    else if (year) p = 'yearly';
    else p = 'monthly';
  }

  let fromDate;
  let toDate;

  if (from || to) {
    fromDate = from ? startOfDay(new Date(from)) : null;
    toDate = to ? endOfDay(new Date(to)) : endOfDay(today);
    if (!fromDate) {
      // Infer a sensible start when only `to` is provided.
      if (p === 'daily') fromDate = startOfDay(toDate);
      else if (p === 'weekly') fromDate = startOfWeekMonday(toDate);
      else if (p === 'monthly') {
        fromDate = startOfDay(new Date(toDate.getFullYear(), toDate.getMonth(), 1));
      } else if (p === 'quarterly') fromDate = startOfQuarter(toDate);
      else fromDate = startOfDay(new Date(toDate.getFullYear(), 0, 1));
    }
  } else if (year && (!period || p === 'yearly')) {
    const y = Number(year) || today.getFullYear();
    fromDate = startOfDay(new Date(y, 0, 1));
    toDate = endOfDay(new Date(y, 11, 31));
    p = 'yearly';
  } else {
    toDate = endOfDay(today);
    if (p === 'daily') {
      fromDate = startOfDay(today);
    } else if (p === 'weekly') {
      fromDate = startOfWeekMonday(today);
    } else if (p === 'monthly') {
      fromDate = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (p === 'quarterly') {
      fromDate = startOfQuarter(today);
    } else {
      fromDate = startOfDay(new Date(today.getFullYear(), 0, 1));
      p = 'yearly';
    }
  }

  const fromStr = toDateKey(fromDate);
  const toStr = toDateKey(toDate);
  const resolvedYear = fromDate.getFullYear();

  return {
    period: p === 'custom' ? 'monthly' : p,
    from: fromStr,
    to: toStr,
    fromDate,
    toDate,
    year: resolvedYear,
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
  startOfDay,
  endOfDay,
};
