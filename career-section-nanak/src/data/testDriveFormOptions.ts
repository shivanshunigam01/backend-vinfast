/** Labels match backend `TestDrive` enums — keep in sync with `backend/src/constants/enums.js`. */
export const TEST_DRIVE_LOCATION_OPTIONS = ["Dealership Visit", "Home Test Drive"] as const;
export const OWNS_CAR_OPTIONS = ["Yes", "No"] as const;
export const PURCHASE_TIMELINE_OPTIONS = [
  "0-1 Month",
  "1-3 Months",
  "3-6 Months",
  "Just Exploring",
] as const;

export type TestDriveLocationOption = (typeof TEST_DRIVE_LOCATION_OPTIONS)[number];
export type OwnsCarOption = (typeof OWNS_CAR_OPTIONS)[number];
export type PurchaseTimelineOption = (typeof PURCHASE_TIMELINE_OPTIONS)[number];
