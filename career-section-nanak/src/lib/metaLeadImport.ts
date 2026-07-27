import * as XLSX from "xlsx";
import { LEAD_STATUSES } from "@/data/mockData";

export type MetaLeadImportRow = {
  name: string;
  mobile: string;
  whatsappNumber?: string;
  email?: string;
  state?: string;
  pin?: string;
  interestedModel?: string;
  existingVehicle?: string;
  status?: string;
  remarks?: string;
  financeNeeded?: boolean;
  exchangeNeeded?: boolean;
  source?: string;
};

const COLUMN_ALIASES: Record<keyof MetaLeadImportRow, string[]> = {
  name: ["name", "customer name", "full name", "lead name"],
  mobile: ["mobile", "contact", "phone", "contact no", "contact number", "mobile number"],
  whatsappNumber: ["whatsapp", "whatsapp number", "wa number", "whatsapp no"],
  email: ["email", "email id", "e-mail"],
  state: ["state", "city", "location"],
  pin: ["pin", "pincode", "pin code", "zip"],
  interestedModel: ["interested model", "model", "vehicle", "interested vehicle"],
  existingVehicle: ["existing vehicle", "current vehicle", "owned vehicle"],
  status: ["status", "lead status"],
  remarks: ["remarks", "notes", "comment", "comments"],
  financeNeeded: ["finance needed", "finance", "need finance"],
  exchangeNeeded: ["exchange needed", "exchange", "need exchange"],
  source: ["source", "lead source"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchColumn(header: string): keyof MetaLeadImportRow | null {
  const n = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof MetaLeadImportRow, string[]][]) {
    if (aliases.some((a) => n === a || n.includes(a))) return field;
  }
  return null;
}

function parseBool(value: unknown): boolean | undefined {
  if (value == null || value === "") return undefined;
  const s = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return undefined;
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function mapSheetRow(raw: Record<string, unknown>): MetaLeadImportRow | null {
  const mapped: Partial<MetaLeadImportRow> = {};
  for (const [header, value] of Object.entries(raw)) {
    const field = matchColumn(header);
    if (!field) continue;
    if (field === "financeNeeded" || field === "exchangeNeeded") {
      const b = parseBool(value);
      if (b !== undefined) mapped[field] = b;
    } else {
      mapped[field] = cellStr(value);
    }
  }

  const name = mapped.name?.trim();
  const mobile = mapped.mobile?.trim();
  if (!name || !mobile) return null;

  let status = mapped.status?.trim();
  if (status && !LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    status = "New Lead";
  }

  return {
    name,
    mobile,
    whatsappNumber: mapped.whatsappNumber || mobile,
    email: mapped.email,
    state: mapped.state,
    pin: mapped.pin,
    interestedModel: mapped.interestedModel || "VF7",
    existingVehicle: mapped.existingVehicle || "N/A",
    status: status || "New Lead",
    remarks: mapped.remarks,
    financeNeeded: mapped.financeNeeded ?? false,
    exchangeNeeded: mapped.exchangeNeeded ?? false,
    source: mapped.source || "Meta Ads",
  };
}

export async function parseMetaLeadSpreadsheet(file: File): Promise<MetaLeadImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map(mapSheetRow).filter((r): r is MetaLeadImportRow => r != null);
}

export function downloadMetaLeadImportTemplate(): void {
  const headers = [
    "Name",
    "Mobile",
    "WhatsApp Number",
    "Email",
    "State",
    "PIN",
    "Interested Model",
    "Existing Vehicle",
    "Status",
    "Remarks",
    "Finance Needed",
    "Exchange Needed",
  ];
  const sample = [
    "John Doe",
    "9876543210",
    "9876543210",
    "john@example.com",
    "Jharkhand",
    "834001",
    "VF7",
    "N/A",
    "New Lead",
    "",
    "No",
    "No",
  ];
  const csv = [headers.join(","), sample.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meta-leads-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
