import { adminGet, adminPatchJson, adminPostJson, adminDeleteJson, adminDownloadBlob, adminPostFormData } from "@/lib/api";
import { CRM_LEAD_STAGES, type CrmLeadStage } from "@/lib/leadStages";
import { LEAD_SOURCE_OPTIONS } from "@/data/leadSources";
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
  mobile: string;
  email?: string;
  city?: string;
  model: string;
  source?: string;
  status: string;
  remarks?: string;
  nextFollowUp?: string;
  assignedTo?: { _id: string; name: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
  lastActivityAt?: string;
  convertedAt?: string;
  convertedCustomerId?: { _id: string; customerId?: string; name?: string; mobile?: string } | string | null;
};

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
  status: "pending" | "completed" | "cancelled";
  createdAt: string;
  createdBy?: { name?: string; email?: string } | null;
};

export type PvCrmLeadDetail = {
  lead: PvCrmLead;
  history: LeadStageHistoryItem[];
  followUps: LeadFollowUpItem[];
  siblingLeads?: { leadId?: string; opportunityId?: string; model: string; status: string; source?: string; createdAt?: string }[];
  stages: CrmLeadStage[];
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
  source?: string;
  remarks?: string;
  interest?: string;
  financeNeeded?: boolean;
  exchangeNeeded?: boolean;
  executiveId?: string;
  subCustomerName?: string;
  subCustomerMobile?: string;
  vehicleRegistration?: string;
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

export type PvCrmLeadDateField = "created" | "activity";

export async function fetchPvCrmLeads(params?: {
  search?: string;
  status?: string;
  source?: string;
  followUpDue?: boolean;
  assignedTo?: string;
  from?: string;
  to?: string;
  dateField?: PvCrmLeadDateField;
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
  if (params?.assignedTo) q.set("assignedTo", params.assignedTo);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.dateField && params.dateField !== "created") q.set("dateField", params.dateField);

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
    siblingLeads: asArray(wrapped?.siblingLeads),
    stages: asArray<CrmLeadStage>(wrapped?.stages).length
      ? asArray<CrmLeadStage>(wrapped?.stages)
      : [...CRM_LEAD_STAGES],
  };
}

export type UpdatePvCrmLeadDetailsPayload = {
  name?: string;
  mobile?: string;
  email?: string;
  city?: string;
  otherCity?: string;
  model?: string;
  source?: string;
  interest?: string;
  vehicleRegistration?: string;
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

export async function addPvCrmFollowUp(
  leadId: string,
  payload: { note: string; scheduledAt?: string; outcome?: string; markCompleted?: boolean },
): Promise<LeadFollowUpItem> {
  return adminPostJson<LeadFollowUpItem>(`${CRM_BASE}/${leadId}/follow-ups`, payload);
}

export async function completePvCrmFollowUp(leadId: string, followUpId: string, outcome?: string): Promise<LeadFollowUpItem> {
  return adminPatchJson<LeadFollowUpItem>(`${CRM_BASE}/${leadId}/follow-ups/${followUpId}`, {
    status: "completed",
    outcome,
  });
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

export type CrmLeadImportResult = {
  created: number;
  followUpsCreated?: number;
  failed: CrmLeadImportFailure[];
};

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
}): Promise<void> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.source && params.source !== "all") q.set("source", params.source);
  if (params?.assignedTo) q.set("assignedTo", params.assignedTo);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.dateField && params.dateField !== "created") q.set("dateField", params.dateField);
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
export async function importPvCrmLeadsFile(file: File): Promise<CrmLeadImportResult> {
  const form = new FormData();
  form.append("file", file);
  return adminPostFormData<CrmLeadImportResult>(`${CRM_BASE}/import`, form);
}

/** Client-side blank template matching the CRM import/export columns. */
export function downloadPvCrmLeadImportTemplate(): void {
  const leadHeaders = [
    "Name",
    "Mobile",
    "Email",
    "City",
    "Model",
    "Source",
    "Status",
    "Remarks",
    "AssignedToEmail",
    "NextFollowUp",
    "FinanceNeeded",
    "ExchangeNeeded",
  ];
  const sample = [
    {
      Name: "Sample Customer",
      Mobile: "9876543210",
      Email: "sample@example.com",
      City: "Patna",
      Model: "VF 7",
      Source: "Excel Import",
      Status: "Enquiry",
      Remarks: "",
      AssignedToEmail: "",
      NextFollowUp: "",
      FinanceNeeded: "No",
      ExchangeNeeded: "No",
    },
  ];
  const followHeaders = [
    "Mobile",
    "LeadId",
    "Note",
    "ScheduledAt",
    "CompletedAt",
    "Outcome",
    "Status",
    "CreatedAt",
  ];
  const followSample = [
    {
      Mobile: "9876543210",
      LeadId: "",
      Note: "Called customer — interested in VF 7",
      ScheduledAt: "",
      CompletedAt: "",
      Outcome: "",
      Status: "pending",
      CreatedAt: "",
    },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample, { header: leadHeaders }), "Leads");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(followSample, { header: followHeaders }),
    "FollowUps",
  );
  XLSX.writeFile(wb, "crm-leads-import-template.xlsx");
}

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
