/** All 38 districts of Bihar (alphabetical). */
export const BIHAR_DISTRICTS: readonly string[] = [
  "Araria",
  "Arwal",
  "Aurangabad",
  "Banka",
  "Begusarai",
  "Bhagalpur",
  "Bhojpur",
  "Buxar",
  "Darbhanga",
  "East Champaran",
  "Gaya",
  "Gopalganj",
  "Jamui",
  "Jehanabad",
  "Kaimur (Bhabua)",
  "Katihar",
  "Khagaria",
  "Kishanganj",
  "Lakhisarai",
  "Madhepura",
  "Madhubani",
  "Munger",
  "Muzaffarpur",
  "Nalanda",
  "Nawada",
  "Patna",
  "Purnia",
  "Rohtas",
  "Saharsa",
  "Samastipur",
  "Saran",
  "Sheikhpura",
  "Sheohar",
  "Sitamarhi",
  "Siwan",
  "Supaul",
  "Vaishali",
  "West Champaran",
] as const;

export const BIHAR_DEFAULT_DISTRICT = "Patna";
export const PATNA_DISTRICT = "Patna";

/** Value used when the user is outside Bihar; pairs with a free-text field. */
export const DISTRICT_OTHER = "Other" as const;

/** Single string for leads / bookings (local storage & APIs without otherCity). */
export function resolvedDistrictLabel(district: string, otherDetail: string): string {
  if (district === DISTRICT_OTHER) return (otherDetail.trim() || DISTRICT_OTHER);
  return district;
}

/** Test-drive policy: service is currently available only inside Patna district. */
export function isPatnaDistrict(district: string): boolean {
  return district.trim().toLowerCase() === PATNA_DISTRICT.toLowerCase();
}
