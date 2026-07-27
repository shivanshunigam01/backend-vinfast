import type { Enquiry, Lead, TestDriveBooking } from "@/data/mockData";

export const VF_STORAGE_KEYS = {
  leads: "vf_leads",
  testDrives: "vf_test_drive_bookings",
  enquiries: "vf_enquiries",
} as const;

export type VfStorageKey = (typeof VF_STORAGE_KEYS)[keyof typeof VF_STORAGE_KEYS];

const VF_STORAGE_EVENT = "vf-storage-updated";

function isBrowser() {
  return globalThis.window?.localStorage !== undefined;
}

function emitVfStorageUpdated(key: VfStorageKey) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(VF_STORAGE_EVENT, { detail: { key } }));
}

/** Same-tab + other-tab updates (other tabs use native `storage`). */
export function subscribeVfStorage(key: VfStorageKey, callback: () => void) {
  if (!isBrowser()) return () => {};
  const onCustom = (e: Event) => {
    const ce = e as CustomEvent<{ key: VfStorageKey }>;
    if (ce.detail?.key === key) callback();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) callback();
  };
  window.addEventListener(VF_STORAGE_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(VF_STORAGE_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

function loadJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  const raw = globalThis.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  globalThis.localStorage.setItem(key, JSON.stringify(value));
}

/** `raw === null` → never saved; seed demo data once. Saved `[]` → real empty list (do not replace with mocks). */
export function getLeadsAdminInitial(): { seedMock: boolean; leads: Lead[] } {
  if (!isBrowser()) return { seedMock: true, leads: [] };
  const raw = localStorage.getItem(VF_STORAGE_KEYS.leads);
  if (raw === null) return { seedMock: true, leads: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { seedMock: false, leads: [] };
    return { seedMock: false, leads: parsed as Lead[] };
  } catch {
    return { seedMock: false, leads: [] };
  }
}

export function getTestDrivesAdminInitial(): { seedMock: boolean; bookings: TestDriveBooking[] } {
  if (!isBrowser()) return { seedMock: true, bookings: [] };
  const raw = localStorage.getItem(VF_STORAGE_KEYS.testDrives);
  if (raw === null) return { seedMock: true, bookings: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { seedMock: false, bookings: [] };
    return { seedMock: false, bookings: parsed as TestDriveBooking[] };
  } catch {
    return { seedMock: false, bookings: [] };
  }
}

export function getEnquiriesAdminInitial(): { seedMock: boolean; enquiries: Enquiry[] } {
  if (!isBrowser()) return { seedMock: true, enquiries: [] };
  const raw = localStorage.getItem(VF_STORAGE_KEYS.enquiries);
  if (raw === null) return { seedMock: true, enquiries: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { seedMock: false, enquiries: [] };
    return { seedMock: false, enquiries: parsed as Enquiry[] };
  } catch {
    return { seedMock: false, enquiries: [] };
  }
}

export function getStoredState<T>(key: string, fallback: T): T {
  return loadJson<T>(key, fallback);
}

export function setStoredState<T>(key: string, value: T) {
  saveJson<T>(key, value);
}

export function getLeads(): Lead[] {
  const arr = loadJson<Lead[]>(VF_STORAGE_KEYS.leads, []);
  return Array.isArray(arr) ? arr : [];
}

export function setLeads(leads: Lead[]) {
  saveJson(VF_STORAGE_KEYS.leads, leads);
}

export function addLead(lead: Lead) {
  const leads = getLeads();
  setLeads([...leads, lead]);
  emitVfStorageUpdated(VF_STORAGE_KEYS.leads);
}

export function getTestDriveBookings(): TestDriveBooking[] {
  const arr = loadJson<TestDriveBooking[]>(VF_STORAGE_KEYS.testDrives, []);
  return Array.isArray(arr) ? arr : [];
}

export function setTestDriveBookings(bookings: TestDriveBooking[]) {
  saveJson(VF_STORAGE_KEYS.testDrives, bookings);
}

export function addTestDriveBooking(booking: TestDriveBooking) {
  const bookings = getTestDriveBookings();
  setTestDriveBookings([...bookings, booking]);
  emitVfStorageUpdated(VF_STORAGE_KEYS.testDrives);
}

export function getEnquiries(): Enquiry[] {
  const arr = loadJson<Enquiry[]>(VF_STORAGE_KEYS.enquiries, []);
  return Array.isArray(arr) ? arr : [];
}

export function setEnquiries(enquiries: Enquiry[]) {
  saveJson(VF_STORAGE_KEYS.enquiries, enquiries);
}

export function addEnquiry(enquiry: Enquiry) {
  const enquiries = getEnquiries();
  setEnquiries([...enquiries, enquiry]);
  emitVfStorageUpdated(VF_STORAGE_KEYS.enquiries);
}

