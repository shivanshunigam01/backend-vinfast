import { adminDeleteJson, adminGetData, adminPostJson, adminPutJson } from "@/lib/api";

export type BuyerTypeDoc = {
  _id: string;
  key: string;
  label: string;
  order: number;
  active: boolean;
  systemProtected?: boolean;
};

export async function fetchBuyerTypes(includeInactive = false): Promise<BuyerTypeDoc[]> {
  const q = includeInactive ? "?includeInactive=1" : "";
  const data = await adminGetData<BuyerTypeDoc[]>(`/admin/crm/buyer-types${q}`);
  return Array.isArray(data) ? data : [];
}

export async function createBuyerType(payload: Partial<BuyerTypeDoc> & { label: string }): Promise<BuyerTypeDoc> {
  return adminPostJson<BuyerTypeDoc>("/admin/crm/buyer-types", payload);
}

export async function updateBuyerType(id: string, payload: Partial<BuyerTypeDoc>): Promise<BuyerTypeDoc> {
  return adminPutJson<BuyerTypeDoc>(`/admin/crm/buyer-types/${id}`, payload);
}

export async function deleteBuyerType(id: string): Promise<void> {
  await adminDeleteJson(`/admin/crm/buyer-types/${id}`);
}

export async function reorderBuyerTypes(ids: string[]): Promise<BuyerTypeDoc[]> {
  return adminPutJson<BuyerTypeDoc[]>("/admin/crm/buyer-types/reorder", { ids });
}
