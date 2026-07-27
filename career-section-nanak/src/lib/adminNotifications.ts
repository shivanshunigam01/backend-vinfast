/**
 * Client-side "seen" state for admin header notifications.
 * Fingerprints include the metric value so a new lead / booking re-surfaces
 * the alert even after an earlier dismiss.
 */

const STORAGE_KEY = "vf_admin_notif_dismissed";

type DismissMap = Record<string, number>; // fingerprint → dismissedAt ms

function readMap(): DismissMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: DismissMap) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Stable key for a notification instance (id + current count/value). */
export function notificationFingerprint(id: string, value: number | string): string {
  return `${id}:${value}`;
}

export function isNotificationDismissed(fingerprint: string): boolean {
  return Boolean(readMap()[fingerprint]);
}

export function dismissNotification(fingerprint: string) {
  const map = readMap();
  map[fingerprint] = Date.now();
  // Cap stored entries so localStorage doesn't grow forever.
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 80);
  writeMap(Object.fromEntries(entries));
}

export function dismissNotifications(fingerprints: string[]) {
  const map = readMap();
  const now = Date.now();
  for (const fp of fingerprints) map[fp] = now;
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 80);
  writeMap(Object.fromEntries(entries));
}

export function clearDismissedNotifications() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
