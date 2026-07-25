import { adminGet, adminPatchJson, adminPostJson } from "@/lib/api";
import { CRM_LEAD_STAGES, type CrmLeadStage } from "@/lib/leadStages";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export type CrmLead = {
  _id: string;
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

export type CrmLeadDetail = {
  lead: CrmLead;
  history: LeadStageHistoryItem[];
  followUps: LeadFollowUpItem[];
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

export type CreateCrmLeadPayload = {
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
};

export async function createCrmLead(payload: CreateCrmLeadPayload): Promise<CrmLead> {
  return adminPostJson<CrmLead>("/admin/td/leads", payload);
}

/** Active staff from User Master (TD → User Master module). */
export async function fetchAssignableStaffUsers(): Promise<AssignableStaffUser[]> {
  const { data } = await adminGet<AssignableStaffUser[]>("/admin/td/users/assignable");
  return asArray<AssignableStaffUser>(data);
}

/** @deprecated Use fetchAssignableStaffUsers */
export const fetchCrmExecutives = fetchAssignableStaffUsers;

export async function assignCrmLeadExecutive(leadId: string, executiveId: string | null): Promise<CrmLead> {
  return adminPatchJson<CrmLead>(`/admin/td/leads/${leadId}/assign`, {
    executiveId: executiveId || null,
  });
}

export async function fetchCrmLeads(params?: {
  search?: string;
  status?: string;
  followUpDue?: boolean;
  assignedTo?: string;
  limit?: number;
}): Promise<{ leads: CrmLead[]; total: number; stages: CrmLeadStage[] }> {
  const q = new URLSearchParams({ limit: String(params?.limit ?? 100) });
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.followUpDue) q.set("followUpDue", "true");
  if (params?.assignedTo) q.set("assignedTo", params.assignedTo);

  const res = await adminGet<CrmLead[]>(`/admin/td/leads?${q}`);
  const list = asArray<CrmLead>(res.data);
  return {
    leads: list,
    total: res.meta?.total ?? list.length,
    stages: asArray<CrmLeadStage>((res.meta as { stages?: CrmLeadStage[] } | undefined)?.stages).length
      ? asArray<CrmLeadStage>((res.meta as { stages?: CrmLeadStage[] } | undefined)?.stages)
      : [...CRM_LEAD_STAGES],
  };
}

export async function fetchCrmLeadDetail(id: string): Promise<CrmLeadDetail> {
  const { data } = await adminGet<CrmLeadDetail & CrmLead>(`/admin/td/leads/${id}`);
  const wrapped = data as CrmLeadDetail | null | undefined;
  const lead = wrapped?.lead ?? (data && "_id" in data && "mobile" in data ? (data as CrmLead) : null);
  if (!lead?._id) {
    throw new Error("Lead details could not be loaded");
  }
  return {
    lead,
    history: asArray<LeadStageHistoryItem>(wrapped?.history),
    followUps: asArray<LeadFollowUpItem>(wrapped?.followUps),
    stages: asArray<CrmLeadStage>(wrapped?.stages).length
      ? asArray<CrmLeadStage>(wrapped?.stages)
      : [...CRM_LEAD_STAGES],
  };
}

export async function updateCrmLeadStage(id: string, stage: string, reason?: string): Promise<CrmLead> {
  return adminPatchJson<CrmLead>(`/admin/td/leads/${id}/stage`, { stage, reason });
}

export async function updateCrmLeadRemarks(id: string, remarks: string): Promise<CrmLead> {
  return adminPatchJson<CrmLead>(`/admin/td/leads/${id}/remarks`, { remarks });
}

export async function addCrmFollowUp(
  leadId: string,
  payload: { note: string; scheduledAt?: string; outcome?: string; markCompleted?: boolean },
): Promise<LeadFollowUpItem> {
  return adminPostJson<LeadFollowUpItem>(`/admin/td/leads/${leadId}/follow-ups`, payload);
}

export async function completeCrmFollowUp(leadId: string, followUpId: string, outcome?: string): Promise<LeadFollowUpItem> {
  return adminPatchJson<LeadFollowUpItem>(`/admin/td/leads/${leadId}/follow-ups/${followUpId}`, {
    status: "completed",
    outcome,
  });
}
