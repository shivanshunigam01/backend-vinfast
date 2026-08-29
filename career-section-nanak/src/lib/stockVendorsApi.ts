import { adminDeleteJson, adminGet, adminPostJson, adminPutJson } from "@/lib/api";

const BASE = "/admin/stock/vendors";

export type Vendor = {
  _id: string;
  code: string;
  name: string;
  legalName?: string;
  type?: string;
  gstin?: string;
  pan?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  contactPerson?: string;
  phone?: string;
  email?: string;
  paymentTermsDefault?: string;
  active?: boolean;
  systemProtected?: boolean;
  sortOrder?: number;
  logoUrl?: string;
};

export async function fetchVendors(includeInactive = false) {
  const q = includeInactive ? "?includeInactive=1" : "";
  const { data } = await adminGet<Vendor[]>(`${BASE}${q}`);
  return data ?? [];
}

export async function createVendor(body: Record<string, unknown>) {
  return adminPostJson<Vendor>(BASE, body);
}

export async function updateVendor(id: string, body: Record<string, unknown>) {
  return adminPutJson<Vendor>(`${BASE}/${id}`, body);
}

export async function deleteVendor(id: string) {
  return adminDeleteJson(`${BASE}/${id}`);
}

export function vendorDisplayName(v?: Partial<Vendor> | string | null, fallback = "VinFast") {
  if (!v) return fallback;
  if (typeof v === "string") return v || fallback;
  return v.name || fallback;
}

export function pickDefaultVendor(vendors: Vendor[]) {
  return vendors.find((v) => v.code === "vinfast" || v.name === "VinFast") ?? vendors[0];
}

export function vendorFromPo(po?: {
  supplier?: string;
  supplierId?: Vendor | string | null;
}) {
  if (!po) return { name: "VinFast" };
  if (po.supplierId && typeof po.supplierId === "object") {
    return {
      name: po.supplierId.name,
      legalName: po.supplierId.legalName,
      gstin: po.supplierId.gstin,
    };
  }
  return { name: po.supplier || "VinFast" };
}
