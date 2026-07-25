/** Mirror backend slot schedule helpers for admin UI preview/generate. */

/** Default: 30 min test drive + 15 min gap, 10:00 AM – 6:00 PM */
export const DEFAULT_SLOT_SCHEDULE = {
  slotDuration: 30,
  bufferTime: 15,
  workingStartTime: "10:00",
  workingEndTime: "18:00",
  maxConcurrentBookings: 2,
  autoExpiry: true,
} as const;

export function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function toTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTime12h(time24: string): string {
  const [hStr, m] = time24.split(":");
  let h = parseInt(hStr, 10);
  const mer = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${mer}`;
}

export function generateSlotTimesFromRules(opts: {
  workingStartTime: string;
  workingEndTime: string;
  slotDuration: number;
  bufferTime: number;
}): string[] {
  const times: string[] = [];
  let current = toMinutes(opts.workingStartTime);
  const end = toMinutes(opts.workingEndTime);
  while (current + opts.slotDuration <= end) {
    times.push(toTimeStr(current));
    current += opts.slotDuration + opts.bufferTime;
  }
  return times;
}

export function normalizeSlotTimesList(times: string[]): string[] {
  const normalized = times
    .map((t) => {
      const trimmed = t.trim();
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(":");
        return `${String(parseInt(h, 10)).padStart(2, "0")}:${m}`;
      }
      return null;
    })
    .filter((t): t is string => Boolean(t));
  return [...new Set(normalized)].sort((a, b) => toMinutes(a) - toMinutes(b));
}
