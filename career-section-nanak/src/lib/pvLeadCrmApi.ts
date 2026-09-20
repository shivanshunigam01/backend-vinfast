import { adminGet, adminPatchJson, adminPostJson, adminDeleteJson, adminDownloadBlob, adminPostFormData } from "@/lib/api";
import { CRM_LEAD_STAGES, type CrmLeadStage } from "@/lib/leadStages";
import { LEAD_SOURCE_OPTIONS } from "@/data/leadSources";
import { CRM_CURRENT_FORMAT_HEADERS, buildCrmImportTemplateRow } from "@/lib/crmImportFormat";
import * as XLSX from "xlsx";

const CRM_BASE = "/admin/crm/leads";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export type PvCrmLead = {
  _id: string;
  leadId?: string;
  opportunityId?: string;
  customerId?: string | null;
  parentCustomerId?: string | null;
  subCustomerCode?: string | null;
  subCustomerName?: string | null;
  vehicleRegistration?: string | null;
  name: string;
  customerName?: string;
  mobile: string;
  email?: string;
  city?: string;
  area?: string;
  address?: string;
  leadType?: string;
  buyerType?: string;
  interestLevel?: string;
  model: string;
  /** Public multi-interest product list (VF 6, VF 7, …). */
  interestedModels?: string[];
  source?: string;
  status: string;
  remarks?: string;
  nextFollowUp?: string;
  firstRespondedAt?: string | null;
  leadAgeDays?: number;
  followUpHighlight?: "overdue" | "today" | "future" | "none";
  isFavourite?: boolean;
  followUpCount?: number;
  exchangeNeeded?: boolean;
  financeNeeded?: boolean;
  assignedTo?: { _id: string; name: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
  lastActivityAt?: string;
  convertedAt?: string;
  convertedCustomerId?: { _id: string; customerId?: string; name?: string; mobile?: string } | string | null;
  /** Canonical enquiry/received date from CRE sheet (falls back to createdAt). */
  enquiryDate?: string | null;
  creSheet?: Record<string, unknown> | null;
  /** Present when stage→Booking auto-created/opened a vehicle order. */
  vehicleOrder?: { _id: string; orderNumber: string; stage: string; created: boolean };
  /** Present when Booking stage saved but order ensure failed (e.g. missing model). */
  vehicleOrderError?: string;
};

export function displayCrmLeadName(lead?: { customerName?: string; name?: string } | null): string {
  if (!lead) return "Lead";
  return (lead.customerName || lead.name || "Lead").trim() || "Lead";
}

export type LeadStageHistoryItem = {
  _id: string;
  fromStage?: string;
  toStage: string;
  reason?: string;
  createdAt: string;
  changedBy?: { name?: string; email?: string } | null;
};

export type LeadFollowUpItem = {
  _id: string;
  note: string;
  scheduledAt?: string;
  completedAt?: string;
  outcome?: string;
  nextAction?: string;
  nextFollowUpAt?: string;
  interestLevel?: "HOT" | "WARM" | "COLD";
  status: "pending" | "completed" | "cancelled";
  createdAt: string;
  createdBy?: { name?: string; email?: string } | null;
};

export type CreSheetFollowUpSlot = {
  creDate?: string | null;
  creRemark?: string;
  salesDate?: string | null;
  salesRemark?: string;
  creFollowUpId?: string | null;
  salesFollowUpId?: string | null;
};

export type PvCrmLeadTdBooking = {
  _id?: string;
  bookingId?: string;
  bookingStatus?: string;
  slotDate?: string;
  slotTime?: string;
  preferredModel?: string;
  approvalStatus?: string;
  isRepeatDrive?: boolean;
  createdAt?: string;
};

export type PvCrmLeadTestDriveState = {
  hasCompletedTestDrive?: boolean;
  hasActiveBooking?: boolean;
  hasPendingApproval?: boolean;
  canBookTestDrive?: boolean;
  bookings?: PvCrmLeadTdBooking[];
};

export type PvCrmLeadDetail = {
  lead: PvCrmLead;
  history: LeadStageHistoryItem[];
  followUps: LeadFollowUpItem[];
  followUpCount?: number;
  followUpSlots?: CreSheetFollowUpSlot[];
  siblingLeads?: { leadId?: string; opportunityId?: string; model: string; status: string; source?: string; createdAt?: string }[];
  stages: CrmLeadStage[];
  testDrive?: PvCrmLeadTestDriveState;
};

export type AssignableStaffUser = {
  _id: string;
  name: string;
  email?: string;
  role?: string;
  designation?: string;
  designationLabel?: string;
};

export type CreatePvCrmLeadPayload = {
  name: string;
  mobile: string;
  email?: string;
  city: string;
  otherCity?: string;
  model: string;
  interestedModels?: string[];
  source?: string;
  remarks?: string;
  interest?: string;
  financeNeeded?: boolean;
  exchangeNeeded?: boolean;
  executiveId?: string;
  subCustomerName?: string;
  subCustomerMobile?: string;
  vehicleRegistration?: string;
  buyerType?: string;
  /** Create a separate opportunity when customer already has an open lead. */
  forceNewOpportunity?: boolean;
  allowMultiOpportunity?: boolean;
  /** CRE Current Format sheet dates and columns (optional at create). */
  creSheet?: Record<string, unknown>;
  followUpSlots?: CreSheetFollowUpSlot[];
  salesConsultant?: string;
  enquiryDate?: string;
  callDate?: string;
};

export async function createPvCrmLead(payload: CreatePvCrmLeadPayload): Promise<PvCrmLead> {
  return adminPostJson<PvCrmLead>(CRM_BASE, payload);
}

export async function fetchAssignableStaffUsers(): Promise<AssignableStaffUser[]> {
  const { data } = await adminGet<AssignableStaffUser[]>("/admin/td/users/assignable");
  return asArray<AssignableStaffUser>(data);
}

export async function assignPvCrmLeadExecutive(leadId: string, executiveId: string | null): Promise<PvCrmLead> {
  return adminPatchJson<PvCrmLead>(`${CRM_BASE}/${leadId}/assign`, {
    executiveId: executiveId || null,
  });
}

export type PvCrmLeadDateField = "created" | "enquiry" | "activity";

export async function fetchPvCrmLeads(params?: {
  search?: string;
  status?: string;
  source?: string;
  followUpDue?: boolean;
  favourite?: boolean;
  assignedTo?: string;
  from?: string;
  to?: string;
  dateField?: PvCrmLeadDateField;
  buyerType?: string;
  model?: string;
  customerId?: string;
  customerFollowUps?: boolean;
  pvCustomerId?: string;
  page?: number;
  limit?: number;
}): Promise<{ leads: PvCrmLead[]; total: number; page: number; limit: number; stages: CrmLeadStage[] }> {
  const page = Math.max(params?.page ?? 1, 1);
  const limit = Math.max(params?.limit ?? 20, 1);
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.source && params.source !== "all") q.set("source", params.source);
  if (params?.followUpDue) q.set("followUpDue", "true");
  if (params?.favourite) q.set("favourite", "true");
  if (params?.assignedTo) q.set("assignedTo", params.assignedTo);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.dateField && params.dateField !== "created") q.set("dateField", params.dateField);
  if (params?.buyerType && params.buyerType !== "all") q.set("buyerType", params.buyerType);
  if (params?.model && params.model !== "all") q.set("model", params.model);
  if (params?.customerId) q.set("customerId", params.customerId);
  if (params?.customerFollowUps) q.set("customerFollowUps", "true");
  if (params?.pvCustomerId) q.set("pvCustomerId", params.pvCustomerId);

  const res = await adminGet<PvCrmLead[]>(`${CRM_BASE}?${q}`);
  const list = asArray<PvCrmLead>(res.data);
  return {
    leads: list,
    total: res.meta?.total ?? list.length,
    page: res.meta?.page ?? page,
    limit: res.meta?.limit ?? limit,
    stages: asArray<CrmLeadStage>((res.meta as { stages?: CrmLeadStage[] } | undefined)?.stages).length
      ? asArray<CrmLeadStage>((res.meta as { stages?: CrmLeadStage[] } | undefined)?.stages)
      : [...CRM_LEAD_STAGES],
  };
}

export type ReopenPvCrmLeadPayload = {
  mode: "same" | "new";
  executiveId?: string;
  status?: string;
};

export async function reopenPvCrmLead(id: string, payload: ReopenPvCrmLeadPayload): Promise<PvCrmLead> {
  const data = await adminPostJson<{ lead?: PvCrmLead } & PvCrmLead>(`${CRM_BASE}/${id}/reopen`, payload);
  if (data && typeof data === "object" && "lead" in data && data.lead?._id) {
    return data.lead;
  }
  return data as PvCrmLead;
}

export type CustomerFollowUpRow = LeadFollowUpItem & {
  lead?: {
    _id?: string;
    leadId?: string;
    opportunityId?: string;
    name?: string;
    mobile?: string;
    status?: string;
    model?: string;
  };
};

export async function fetchCustomerFollowUps(customerId: string): Promise<CustomerFollowUpRow[]> {
  const q = new URLSearchParams({ customerId });
  const { data } = await adminGet<CustomerFollowUpRow[]>(`${CRM_BASE}/follow-ups/by-customer?${q}`);
  return asArray<CustomerFollowUpRow>(data);
}

export async function fetchPvCrmLeadDetail(id: string): Promise<PvCrmLeadDetail> {
  const { data } = await adminGet<PvCrmLeadDetail & PvCrmLead>(`${CRM_BASE}/${id}`);
  const wrapped = data as PvCrmLeadDetail | null | undefined;
  const lead = wrapped?.lead ?? (data && "_id" in data && "mobile" in data ? (data as PvCrmLead) : null);
  if (!lead?._id) {
    throw new Error("Lead details could not be loaded");
  }
  return {
    lead,
    history: asArray<LeadStageHistoryItem>(wrapped?.history),
    followUps: asArray<LeadFollowUpItem>(wrapped?.followUps),
    followUpSlots: asArray<CreSheetFollowUpSlot>(wrapped?.followUpSlots),
    siblingLeads: asArray(wrapped?.siblingLeads),
    stages: asArray<CrmLeadStage>(wrapped?.stages).length
      ? asArray<CrmLeadStage>(wrapped?.stages)
      : [...CRM_LEAD_STAGES],
    testDrive: wrapped?.testDrive as PvCrmLeadTestDriveState | undefined,
  };
}

export type UpdatePvCrmLeadDetailsPayload = {
  name?: string;
  mobile?: string;
  email?: string;
  city?: string;
  otherCity?: string;
  model?: string;
  interestedModels?: string[];
  source?: string;
  interest?: string;
  vehicleRegistration?: string;
  buyerType?: string;
  interestLevel?: string;
  financeNeeded?: boolean;
  exchangeNeeded?: boolean;
};

/** Admin (manager/superadmin) edit of core lead details. */
export async function updatePvCrmLeadDetails(
  id: string,
  payload: UpdatePvCrmLeadDetailsPayload,
): Promise<PvCrmLead> {
  return adminPatchJson<PvCrmLead>(`${CRM_BASE}/${id}/details`, payload);
}

export async function updatePvCrmLeadStage(id: string, stage: string, reason?: string): Promise<PvCrmLead> {
  return adminPatchJson<PvCrmLead>(`${CRM_BASE}/${id}/stage`, { stage, reason });
}

export async function updatePvCrmLeadRemarks(id: string, remarks: string): Promise<PvCrmLead> {
  return adminPatchJson<PvCrmLead>(`${CRM_BASE}/${id}/remarks`, { remarks });
}

export type UpdatePvCrmLeadCreSheetPayload = {
  creSheet?: Record<string, unknown>;
  followUpSlots?: CreSheetFollowUpSlot[];
  salesConsultant?: string;
  followUp?: string;
  exchangeNeeded?: boolean;
};

export async function updatePvCrmLeadCreSheet(
  id: string,
  payload: UpdatePvCrmLeadCreSheetPayload,
): Promise<{ lead: PvCrmLead; followUpSlots: CreSheetFollowUpSlot[] }> {
  return adminPatchJson<{ lead: PvCrmLead; followUpSlots: CreSheetFollowUpSlot[] }>(
    `${CRM_BASE}/${id}/cre-sheet`,
    payload,
  );
}

export async function addPvCrmFollowUp(
  leadId: string,
  payload: {
    note: string;
    scheduledAt?: string;
    outcome?: string;
    markCompleted?: boolean;
    nextAction?: string;
    nextFollowUpAt?: string;
    interestLevel?: string;
  },
): Promise<LeadFollowUpItem> {
  return adminPostJson<LeadFollowUpItem>(`${CRM_BASE}/${leadId}/follow-ups`, payload);
}

export async function completePvCrmFollowUp(
  leadId: string,
  followUpId: string,
  payload?: { outcome?: string; note?: string; nextAction?: string; nextFollowUpAt?: string; interestLevel?: string },
): Promise<LeadFollowUpItem> {
  return adminPatchJson<LeadFollowUpItem>(`${CRM_BASE}/${leadId}/follow-ups/${followUpId}`, {
    status: "completed",
    ...payload,
  });
}

export async function togglePvCrmFavourite(leadId: string): Promise<PvCrmLead> {
  return adminPatchJson<PvCrmLead>(`${CRM_BASE}/${leadId}/favourite`, {});
}

export type CrmLeadStats = {
  total: number;
  pipeline: Record<string, number>;
  stages: string[];
  favouriteCount: number;
  followUpDueToday: number;
  followUpOverdue: number;
  newEnquiries: number;
  pendingFollowUps: number;
};

export async function fetchPvCrmLeadStats(params?: {
  source?: string;
  status?: string;
  model?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
  dateField?: PvCrmLeadDateField;
  search?: string;
  buyerType?: string;
  followUpDue?: boolean;
  customerFollowUps?: boolean;
  favourite?: boolean;
}): Promise<CrmLeadStats> {
  const q = new URLSearchParams();
  if (params?.source && params.source !== "all") q.set("source", params.source);
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.model && params.model !== "all") q.set("model", params.model);
  if (params?.assignedTo) q.set("assignedTo", params.assignedTo);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.dateField && params.dateField !== "created") q.set("dateField", params.dateField);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.buyerType && params.buyerType !== "all") q.set("buyerType", params.buyerType);
  if (params?.followUpDue) q.set("followUpDue", "true");
  if (params?.customerFollowUps) q.set("customerFollowUps", "true");
  if (params?.favourite) q.set("favourite", "true");
  const qs = q.toString();
  const { data } = await adminGet<CrmLeadStats>(`${CRM_BASE}/stats${qs ? `?${qs}` : ""}`);
  return data;
}

/** Permanently delete a junk/incorrect CRM lead (managers/superadmins). */
export async function deletePvCrmLead(id: string): Promise<void> {
  await adminDeleteJson(`${CRM_BASE}/${id}`);
}

/** Permanently delete multiple CRM leads (managers/superadmins). Max 100. */
export async function bulkDeletePvCrmLeads(
  ids: string[],
): Promise<{ deleted: number; requested: number }> {
  return adminPostJson<{ deleted: number; requested: number }>(`${CRM_BASE}/bulk-delete`, { ids });
}

export type CrmLeadImportFailure = {
  row: number | string;
  name?: string;
  mobile?: string;
  message: string;
};

export type CrmLeadImportRowStatus =
  | "created"
  | "updated"
  | "would_create"
  | "would_update"
  | "failed"
  | "valid"
  | "needs_model"
  | "invalid";

export type CrmLeadImportRow = {
  row: number | string;
  status: CrmLeadImportRowStatus;
  name?: string;
  mobile?: string;
  model?: string;
  modelRaw?: string;
  leadId?: string;
  message?: string;
  needsCorrection?: boolean;
};

export type CrmLeadImportResult = {
  created: number;
  updated?: number;
  followUpsCreated?: number;
  failed: CrmLeadImportFailure[];
  rows?: CrmLeadImportRow[];
  dryRun?: boolean;
  needsModel?: number;
};

/** Concrete models allowed when correcting ambiguous Excel "Both" / multi-model cells. */
export const CRM_IMPORT_MODEL_OPTIONS = ["VF 6", "VF 7", "VF MPV 7", "Limo Green"] as const;

/** Download failed import rows as Excel (and optional CSV). */
export function downloadCrmImportErrors(
  failed: CrmLeadImportFailure[],
  format: "xlsx" | "csv" = "xlsx",
): void {
  const rows = (failed || []).map((f) => ({
    Row: f.row,
    Name: f.name || "",
    Mobile: f.mobile || "",
    Error: f.message || "",
  }));
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const header = "Row,Name,Mobile,Error";
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map((r) => [r.Row, r.Name, r.Mobile, r.Error].map(escape).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-import-errors-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Errors");
  XLSX.writeFile(wb, `crm-import-errors-${stamp}.xlsx`);
}

/** Download Excel export of current CRM filter (Leads + FollowUps sheets). */
export async function exportPvCrmLeadsExcel(params?: {
  search?: string;
  status?: string;
  source?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
  dateField?: PvCrmLeadDateField;
  buyerType?: string;
}): Promise<void> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.source && params.source !== "all") q.set("source", params.source);
  if (params?.assignedTo) q.set("assignedTo", params.assignedTo);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.dateField && params.dateField !== "created") q.set("dateField", params.dateField);
  if (params?.buyerType && params.buyerType !== "all") q.set("buyerType", params.buyerType);
  const qs = q.toString();
  const { blob, filename } = await adminDownloadBlob(
    `${CRM_BASE}/export${qs ? `?${qs}` : ""}`,
    `crm-leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Upload Excel/CSV for bulk lead import (multipart field name: file). */
export async function importPvCrmLeadsFile(
  file: File,
  opts?: {
    dryRun?: boolean;
    modelCorrections?: Record<string, string>;
  },
): Promise<CrmLeadImportResult> {
  const form = new FormData();
  form.append("file", file);
  if (opts?.modelCorrections && Object.keys(opts.modelCorrections).length > 0) {
    form.append("modelCorrections", JSON.stringify(opts.modelCorrections));
  }
  if (opts?.dryRun) {
    form.append("dryRun", "true");
  }
  const q = opts?.dryRun ? "?dryRun=1" : "";
  return adminPostFormData<CrmLeadImportResult>(`${CRM_BASE}/import${q}`, form);
}

/** Commit import from a corrected leads JSON payload (no file). */
export async function importPvCrmLeadsJson(payload: {
  leads: Array<Record<string, unknown>>;
  followUps?: Array<Record<string, unknown>>;
  dryRun?: boolean;
  modelCorrections?: Record<string, string>;
}): Promise<CrmLeadImportResult> {
  return adminPostJson<CrmLeadImportResult>(`${CRM_BASE}/import`, payload);
}

/** CRE Current Format blank template (all sheet columns; TD = Test Drive). */
export function downloadPvCrmLeadImportTemplate(): void {
  const sample = buildCrmImportTemplateRow();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([sample], { header: [...CRM_CURRENT_FORMAT_HEADERS] }),
    "Sheet3",
  );
  XLSX.writeFile(wb, "crm-current-format-import-template.xlsx");
}

export { CRM_CURRENT_FORMAT_HEADERS };

export type ConvertLeadToSalePayload = {
  /** Fill only when the actual buyer differs from the lead's customer. */
  buyerName?: string;
  buyerMobile?: string;
  buyerEmail?: string;
  buyerCity?: string;
  vehicleRegistration?: string;
  stage?: "Booking" | "Delivered";
  remarks?: string;
};

export type ConvertLeadToSaleResult = {
  lead: PvCrmLead;
  customer: { _id: string; customerId: string; name: string; mobile: string };
  vehicleOrder?: { _id: string; orderNumber: string; stage: string; created: boolean };
  vehicleOrderError?: string;
};

/** Convert an opportunity to a sale; a differing buyer gets its own Customer ID. */
export async function convertPvCrmLeadToSale(
  id: string,
  payload: ConvertLeadToSalePayload,
): Promise<ConvertLeadToSaleResult> {
  return adminPostJson<ConvertLeadToSaleResult>(`${CRM_BASE}/${id}/convert`, payload);
}

export type OpportunityDuplicatesReport = {
  duplicateOpportunityIds: { opportunityId: string; count: number; leadIds: string[] }[];
  multiOpportunityCustomers: {
    mobile: string;
    model: string;
    name?: string;
    count: number;
    opportunities: { leadId?: string; opportunityId?: string; status?: string }[];
  }[];
  leadsMissingOpportunityId: number;
  healthy: boolean;
};

/** Opportunity ID health check (managers/superadmins). */
export async function fetchOpportunityDuplicates(): Promise<OpportunityDuplicatesReport> {
  const { data } = await adminGet<OpportunityDuplicatesReport>(`${CRM_BASE}/duplicates/opportunities`);
  return data;
}

export const PV_CRM_SOURCES = LEAD_SOURCE_OPTIONS;
