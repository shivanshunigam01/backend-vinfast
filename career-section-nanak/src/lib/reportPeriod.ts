/** Client-side report period helpers (aligned with `src/utils/reportPeriod.js`). */

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export const REPORT_PERIODS: ReportPeriod[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date. */
export function parseDateKey(s: string): Date {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfQuarter(d: Date): Date {
  const x = startOfDay(d);
  const q = Math.floor(x.getMonth() / 3) * 3;
  x.setMonth(q, 1);
  return x;
}

export function isFullCalendarYear(from: string, to: string): boolean {
  const a = String(from || "").trim().match(/^(\d{4})-01-01$/);
  const b = String(to || "").trim().match(/^(\d{4})-12-31$/);
  return Boolean(a && b && a[1] === b[1]);
}

/**
 * Compute From/To for a period preset relative to today (or optional `year` for yearly).
 */
export function resolvePeriodRange(opts: {
  period?: string | null;
  year?: number | null;
} = {}): { period: ReportPeriod; from: string; to: string; year: number } {
  const today = startOfDay(new Date());
  let p = String(opts.period || "monthly").toLowerCase();
  if (!REPORT_PERIODS.includes(p as ReportPeriod)) p = "monthly";

  let fromDate: Date;
  let toDate: Date;

  if (p === "yearly" && opts.year) {
    const y = Number(opts.year) || today.getFullYear();
    fromDate = startOfDay(new Date(y, 0, 1));
    toDate = endOfDay(new Date(y, 11, 31));
  } else if (p === "daily") {
    fromDate = startOfDay(today);
    toDate = endOfDay(today);
  } else if (p === "weekly") {
    fromDate = startOfWeekMonday(today);
    toDate = endOfDay(today);
  } else if (p === "monthly") {
    fromDate = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
    toDate = endOfDay(today);
  } else if (p === "quarterly") {
    fromDate = startOfQuarter(today);
    toDate = endOfDay(today);
  } else {
    // yearly (current year)
    fromDate = startOfDay(new Date(today.getFullYear(), 0, 1));
    toDate = endOfDay(new Date(today.getFullYear(), 11, 31));
    p = "yearly";
  }

  return {
    period: p as ReportPeriod,
    from: toDateKey(fromDate),
    to: toDateKey(toDate),
    year: fromDate.getFullYear(),
  };
}
