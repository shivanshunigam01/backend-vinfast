import axios from "axios";
import { adminDeleteJson, adminPostJson } from "@/lib/api";
import { API_BASE } from "@/lib/apiConfig";
import type { MetaLeadImportRow } from "@/lib/metaLeadImport";

/** Public Meta leads list — uses configured API when available. */
export const META_LEADS_API_URL = API_BASE ? `${API_BASE}/public/All_leads` : "";

export type MetaLeadsApiPayload = {
  success?: boolean;
  data?: unknown;
  meta?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
};

export async function fetchMetaLeadsPayload(): Promise<MetaLeadsApiPayload> {
  if (!META_LEADS_API_URL) {
    throw new Error("API is not configured.");
  }
  const { data } = await axios.get<MetaLeadsApiPayload>(META_LEADS_API_URL, {
    headers: { Accept: "application/json" },
  });
  return data;
}

/** Normalize `data` to an array of row objects for the table. */
export function metaLeadsRows(payload: MetaLeadsApiPayload | null): Record<string, unknown>[] {
  if (!payload) return [];
  const d = payload.data;
  if (Array.isArray(d)) return d.filter((x): x is Record<string, unknown> => x != null && typeof x === "object");
  if (d != null && typeof d === "object") return [d as Record<string, unknown>];
  return [];
}

function displayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.trim() ? value : "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "—";
}

function stripPrefix(value: unknown): string {
  const s = value == null ? "" : String(value).trim();
  if (!s) return "";
  const idx = s.indexOf("_");
  return idx >= 0 ? s.slice(idx + 1) : s;
}

function tryParseJson(maybeJson: unknown): unknown | null {
  if (typeof maybeJson !== "string") return null;
  const s = maybeJson.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseFlowToken(flowToken: unknown): Record<string, unknown> {
  // flow_token may be an object already or a stringified JSON.
  const parsed = tryParseJson(flowToken);
  if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  if (flowToken && typeof flowToken === "object") return flowToken as Record<string, unknown>;
  return {};
}

export type MetaLeadRow = {
  id: string; // meta row id
  leadId: string; // linked CRM Lead id
  createdAt: string;
  name: string;
  mobile: string;
  whatsappNumber: string;
  email: string;
  state: string;
  pin: string;
  interestedModel: string;
  status: string;
  source: string;
  model: string;
  nextFollowUp: string;
  existingVehicle: string;
  remarks: string;
  financeNeeded: boolean;
  exchangeNeeded: boolean;
};

/**
 * Map webhook/provider keys into a clean table row.
 * Example keys:
 * - screen_0_Name_0
 * - screen_0_Contact_No_1
 * - screen_0_State_2 (e.g. "1_Jharkhand")
 * - screen_0_PIN_3
 * - screen_0_Interested_Model_5 (e.g. "1_VF7")
 */
export type MetaLeadCreateInput = {
  name: string;
  mobile: string;
  whatsappNumber?: string;
  email?: string;
  state?: string;
  pin?: string;
  interestedModel?: string;
  existingVehicle?: string;
  status?: string;
  nextFollowUp?: string | null;
  remarks?: string;
  financeNeeded?: boolean;
  exchangeNeeded?: boolean;
  source?: string;
};

export async function createMetaLead(input: MetaLeadCreateInput): Promise<MetaLeadRow> {
  const doc = await adminPostJson<Record<string, unknown>>("/admin/meta-leads", {
    ...input,
    nextFollowUp: input.nextFollowUp || null,
  });
  return mapMetaLeadRow(doc);
}

export type MetaLeadBulkResult = {
  created: number;
  failed: { row: number; name?: string; mobile?: string; message: string }[];
};

export async function bulkCreateMetaLeads(leads: MetaLeadImportRow[]): Promise<MetaLeadBulkResult> {
  const data = await adminPostJson<MetaLeadBulkResult>("/admin/meta-leads/bulk", { leads });
  return data;
}

export async function deleteMetaLead(id: string): Promise<void> {
  await adminDeleteJson(`/admin/meta-leads/${encodeURIComponent(id)}`);
}

export function mapMetaLeadRow(doc: Record<string, unknown>): MetaLeadRow {
  const flow = parseFlowToken(doc.flow_token);

  const createdAt = displayValue(doc.createdAt || doc.receivedAt);
  const whatsappNumber = displayValue(doc.whatsapp_number || flow.MobileNumber);
  const mobile = displayValue(
    doc.screen_0_Contact_No_1 ||
      doc.mobile_number ||
      doc.phone_number ||
      flow.MobileNumber ||
      doc.mobile,
  );

  const name =
    displayValue(doc.screen_0_Name_0) ||
    displayValue((flow as { Name?: unknown }).Name) ||
    displayValue((flow as { name?: unknown }).name);

  const email = displayValue(doc.screen_0_Email_ID_4 || doc.email);
  const state = stripPrefix(doc.screen_0_State_2) || "—";
  const pin = displayValue(doc.screen_0_PIN_3 || doc.pin);
  const interestedModel = stripPrefix(doc.screen_0_Interested_Model_5) || "—";
  const status = displayValue(doc.status);
  const source = displayValue(doc.source) === "—" ? "Meta Ads" : displayValue(doc.source);
  const model = displayValue(doc.model) === "—" ? interestedModel : displayValue(doc.model);
  const nextFollowUp = displayValue(doc.nextFollowUp);
  const leadId = typeof doc.leadId === "string" ? doc.leadId : "—";
  const existingVehicle = displayValue(doc.screen_0_Existing_Vehicle__6 || doc.existingVehicle);
  const remarks = displayValue(doc.remarks) === "—" ? "" : displayValue(doc.remarks);
  const financeNeeded = Boolean(doc.financeNeeded);
  const exchangeNeeded = Boolean(doc.exchangeNeeded);

  const mongoId = doc._id != null ? String(doc._id) : "";
  const uniqueId = doc.uniqueId != null ? String(doc.uniqueId).trim() : "";
  const id = mongoId || uniqueId || `${whatsappNumber}-${createdAt}`;

  return {
    id: id || String(Math.random()),
    createdAt,
    name,
    mobile,
    whatsappNumber,
    email,
    state,
    pin,
    interestedModel,
    status,
    source,
    model,
    nextFollowUp,
    leadId,
    existingVehicle,
    remarks,
    financeNeeded,
    exchangeNeeded,
  };
}
