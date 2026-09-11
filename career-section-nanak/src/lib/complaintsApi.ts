import { adminDeleteJson, adminGet, adminPostJson, adminPutJson } from "@/lib/api";

const BASE = "/admin/complaints";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export type ComplaintDirection = "INBOUND" | "OUTBOUND";
export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ComplaintCommunication = {
  _id?: string;
  at?: string;
  direction: ComplaintDirection;
  note: string;
  byName?: string;
};

export type CustomerComplaint = {
  _id: string;
  complaintNo: string;
  direction: ComplaintDirection;
  customerName: string;
  mobile: string;
  email?: string;
  subject: string;
  description?: string;
  category?: string;
  channel?: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  model?: string;
  assignedTo?: { _id: string; name?: string; email?: string } | string | null;
  assignedToName?: string;
  resolution?: string;
  resolvedAt?: string;
  communications?: ComplaintCommunication[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateComplaintPayload = {
  direction: ComplaintDirection;
  customerName: string;
  mobile: string;
  email?: string;
  subject: string;
  description?: string;
  category?: string;
  channel?: string;
  priority?: ComplaintPriority;
  model?: string;
};

export async function fetchComplaints(params: {
  direction: ComplaintDirection;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: CustomerComplaint[]; total: number }> {
  const q = new URLSearchParams({
    direction: params.direction,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  const res = await adminGet<CustomerComplaint[]>(`${BASE}?${q}`);
  return {
    items: asArray<CustomerComplaint>(res.data),
    total: res.meta?.total ?? asArray(res.data).length,
  };
}

export async function createComplaint(payload: CreateComplaintPayload) {
  return adminPostJson<CustomerComplaint>(BASE, payload);
}

export async function updateComplaint(id: string, payload: Partial<CreateComplaintPayload> & {
  status?: ComplaintStatus;
  resolution?: string;
}) {
  return adminPutJson<CustomerComplaint>(`${BASE}/${id}`, payload);
}

export async function addComplaintCommunication(
  id: string,
  body: { note: string; direction?: ComplaintDirection; status?: ComplaintStatus },
) {
  return adminPostJson<CustomerComplaint>(`${BASE}/${id}/communications`, body);
}

export async function deleteComplaint(id: string) {
  return adminDeleteJson(`${BASE}/${id}`);
}
