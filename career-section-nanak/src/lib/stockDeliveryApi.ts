import { adminGet, adminPostJson, adminPatchJson } from "@/lib/api";

export type PurchaseOrderLine = {
  _id?: string;
  model: string;
  variant?: string;
  colour?: string;
  qty: number;
  receivedQty?: number;
};

export type PurchaseOrder = {
  _id: string;
  poNumber: string;
  status: string;
  supplier?: string;
  expectedDate?: string;
  remarks?: string;
  lines: PurchaseOrderLine[];
  raisedAt?: string;
  closedAt?: string;
  createdAt?: string;
};

export type VehicleOrder = {
  _id: string;
  orderNumber: string;
  stage: string;
  leadId?: {
    _id: string;
    name?: string;
    mobile?: string;
    status?: string;
    source?: string;
    model?: string;
    leadId?: string;
  };
  stockId?: {
    _id: string;
    stockId?: string;
    vinNo?: string;
    model?: string;
    status?: string;
    motorNo?: string;
  } | null;
  customerName?: string;
  customerMobile?: string;
  preferredModel?: string;
  preferredVariant?: string;
  preferredColour?: string;
  vinNo?: string;
  motorNo?: string;
  payment?: {
    done?: boolean;
    doneAt?: string;
    notes?: string;
    downPayment?: string;
    finance?: string;
    paymentMode?: string;
  };
  insurance?: { done?: boolean; doneAt?: string; notes?: string };
  registration?: { done?: boolean; doneAt?: string; notes?: string };
  finalPdiPassed?: boolean;
  retailSaleAt?: string;
  deliveredAt?: string;
  feedbackUrl?: string;
  remarks?: string;
  createdAt?: string;
};

export type StockUnitBrief = {
  _id: string;
  stockId: string;
  vinNo: string;
  model: string;
  variant?: string;
  colour?: string;
  motorNo?: string;
  status: string;
  pdiStatus?: string;
  location?: string;
};

const BASE = "/admin/stock-delivery";

export async function fetchPurchaseOrders(params?: { status?: string; limit?: number }) {
  const q = new URLSearchParams({ limit: String(params?.limit ?? 50) });
  if (params?.status) q.set("status", params.status);
  const { data } = await adminGet<PurchaseOrder[]>(`${BASE}/purchase-orders?${q}`);
  return data ?? [];
}

export async function createPurchaseOrder(body: {
  supplier?: string;
  expectedDate?: string;
  remarks?: string;
  lines: PurchaseOrderLine[];
}) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders`, body);
}

export async function raisePurchaseOrder(id: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/release`, {});
}

export async function markDeliveryReady(id: string) {
  return adminPostJson<VehicleOrder>(`${BASE}/orders/${id}/delivery-ready`, {});
}

export async function submitYardPdi(
  stockId: string,
  body: { result: "PASS" | "FAIL"; notes?: string; location?: string },
) {
  return adminPostJson(`${BASE}/stock/${stockId}/yard-pdi`, body);
}

export async function fetchVehicleOrders(params?: { stage?: string; leadId?: string; limit?: number }) {
  const q = new URLSearchParams({ limit: String(params?.limit ?? 50) });
  if (params?.stage) q.set("stage", params.stage);
  if (params?.leadId) q.set("leadId", params.leadId);
  const { data } = await adminGet<VehicleOrder[]>(`${BASE}/orders?${q}`);
  return data ?? [];
}

export async function createVehicleOrder(body: {
  leadId: string;
  preferredModel?: string;
  preferredVariant?: string;
  preferredColour?: string;
  remarks?: string;
}) {
  return adminPostJson<VehicleOrder>(`${BASE}/orders`, body);
}

export async function fetchAvailability(params: { model: string; variant?: string; colour?: string }) {
  const q = new URLSearchParams({ model: params.model });
  if (params.variant) q.set("variant", params.variant);
  if (params.colour) q.set("colour", params.colour);
  const { data } = await adminGet<{ count: number; units: StockUnitBrief[] }>(
    `${BASE}/orders/availability?${q}`,
  );
  return data ?? { count: 0, units: [] };
}

export async function allocateOrder(id: string, stockId?: string) {
  return adminPostJson<VehicleOrder>(`${BASE}/orders/${id}/allocate`, stockId ? { stockId } : {});
}

export async function releaseOrder(id: string) {
  return adminPostJson<VehicleOrder>(`${BASE}/orders/${id}/release`, {});
}

export async function updateOrderPayment(
  id: string,
  body: {
    done?: boolean;
    notes?: string;
    downPayment?: string;
    finance?: string;
    paymentMode?: string;
  },
) {
  return adminPatchJson<VehicleOrder>(`${BASE}/orders/${id}/payment`, body);
}

export async function updateOrderInsurance(id: string, body: { done?: boolean; notes?: string }) {
  return adminPatchJson<VehicleOrder>(`${BASE}/orders/${id}/insurance`, body);
}

export async function updateOrderRegistration(
  id: string,
  body: { done?: boolean; notes?: string; registrationNo?: string },
) {
  return adminPatchJson<VehicleOrder>(`${BASE}/orders/${id}/registration`, body);
}

export async function submitFinalPdi(id: string, body: { result: "PASS" | "FAIL"; notes?: string }) {
  return adminPostJson(`${BASE}/orders/${id}/final-pdi`, body);
}

export async function retailSale(id: string) {
  return adminPostJson<VehicleOrder>(`${BASE}/orders/${id}/retail-sale`, {});
}

export async function deliverOrder(id: string) {
  return adminPostJson<VehicleOrder>(`${BASE}/orders/${id}/deliver`, {});
}

export async function fetchDeliveries(limit = 50) {
  const { data } = await adminGet<VehicleOrder[]>(`${BASE}/deliveries?limit=${limit}`);
  return data ?? [];
}
