/**
 * CRE Current Format — bulk lead / test-drive import columns.
 * Keep in sync with src/utils/creCurrentFormatImport.js (backend).
 */
export const CRM_CURRENT_FORMAT_HEADERS = [
  "Sl. No.",
  "ENQUIRY DATE",
  "LEAD SOURCE",
  "CUSTOMER NAME",
  "PHONE",
  "MAIL ID",
  "LOCATION",
  "EXISTING VARIANT",
  "MODEL",
  "CALL DATE",
  "INITIAL REMARK",
  "FOLLOW-UP",
  "SALES CONSULTANT",
  "Sales Consultant DATE",
  "SALES PERSON REMARK",
  "TD Date",
  "TD DONE\nYES/ NO",
  "TD NOT DONE,\nWHY?",
  "AFTER TD REMARK",
  "CRE Follow up call 1 Date",
  "CRE Follow up call remark 1",
  "Sales Person Follow up call 1 Date",
  "Sales Person Follow up call 1 Remark 1",
  "CRE Follow up call 2 Date",
  "CRE Follow up call remark 2",
  "Sales Person Follow up call remark 2 Date",
  "Sales Person Follow up call remark 2",
  "CRE Follow up call 3 Date",
  "CRE Follow up call remark 3",
  "Sales Person Follow up call remark 3 Date",
  "Sales Person Follow up call remark 3",
  "BOOKING DONE\nYES / NO",
  "BOOKING DATE",
  "FINAL MODEL",
  "FINAL VARIANT",
  "FINAL COLOUR",
  "MAIL SENT\nYES / NO",
  "EXCHANGE\nYES / NO",
  "RETAIL DONE\nYES / NO",
  "RETAIL DATE",
  "DELIVERY DATE",
] as const;

/** Sample row for blank Excel template download. */
export function buildCrmImportTemplateRow(): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  for (const header of CRM_CURRENT_FORMAT_HEADERS) row[header] = "";
  row["Sl. No."] = 1;
  row["LEAD SOURCE"] = "Walk-In";
  row["CUSTOMER NAME"] = "Sample Customer";
  row.PHONE = "9876543210";
  row["MAIL ID"] = "sample@example.com";
  row.LOCATION = "Patna";
  row["EXISTING VARIANT"] = "NO";
  row.MODEL = "VF 7";
  row["FOLLOW-UP"] = "HOT";
  row["TD DONE\nYES/ NO"] = "NO";
  row["BOOKING DONE\nYES / NO"] = "NO";
  row["MAIL SENT\nYES / NO"] = "NO";
  row["EXCHANGE\nYES / NO"] = "NO";
  row["RETAIL DONE\nYES / NO"] = "NO";
  return row;
}
