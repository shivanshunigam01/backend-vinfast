import { adminGet, adminPostJson, adminPutJson, adminPatchJson } from "@/lib/api";

const BASE = "/admin/stock/pipeline";

export type PoLine = {
  _id?: string;
  model: string;
  variant?: string;
  colour?: string;
  interiorColour?: string;
  batteryConfig?: string;
  modelYear?: number;
  qty: number;
  receivedQty?: number;
  basicPrice?: number;
  gstAmount?: number;
  freight?: number;
  discount?: number;
  netPurchaseValue?: number;
};

export type PurchaseOrder = {
  _id: string;
  poNumber: string;
  poDate?: string;
  poType?: string;
  status: string;
  supplier?: string;
  deliveryLocation?: string;
  paymentTerms?: string;
  fundingBank?: string;
  bookingLinked?: boolean;
  bookingNumber?: string;
  lines: PoLine[];
  approvalHistory?: Array<{ action: string; status: string; byName?: string; at?: string; remarks?: string }>;
  remarks?: string;
  createdAt?: string;
};

export type DispatchRecord = {
  _id: string;
  dispatchNumber: string;
  purchaseOrderId: string | PurchaseOrder;
  poNumber?: string;
  oemInvoiceNumber: string;
  oemInvoiceDate: string;
  dispatchDate: string;
  transporter: string;
  lrNumber: string;
  truckNumber: string;
  status: string;
  items: Array<{ vin: string; model: string; variant?: string; colour?: string; configMatch?: string }>;
};

export type StockUnit = {
  _id: string;
  stockId: string;
  vinNo: string;
  model: string;
  variant?: string;
  colour?: string;
  vehicleStatus?: string;
  status: string;
  grnDate?: string;
  ageingBucket?: string;
  lastSoc?: number;
  holdStatus?: boolean;
  location?: string;
};

export type DashboardKpis = {
  procurement: { poRaised: number; poValue: number };
  transit: { inTransit: number };
  receipt: { grnPending: number; receiptExceptions: number };
  pdi: { pdiPending: number; pdiFailedHold: number };
  stock: { physicalStock: number; availableStock: number; reservedBooked: number; ageing60Plus: number };
  evHealth: { lowSocAlert: number };
};

export async function fetchStockDashboard(params?: { branchId?: string; model?: string }) {
  const q = new URLSearchParams();
  if (params?.branchId) q.set("branchId", params.branchId);
  if (params?.model) q.set("model", params.model);
  const { data } = await adminGet<DashboardKpis>(`${BASE}/dashboard?${q}`);
  return data!;
}

export async function fetchPipelinePurchaseOrders(params?: { status?: string; limit?: number }) {
  const q = new URLSearchParams({ limit: String(params?.limit ?? 50) });
  if (params?.status) q.set("status", params.status);
  const { data } = await adminGet<PurchaseOrder[]>(`${BASE}/purchase-orders?${q}`);
  return data ?? [];
}

export async function createPipelinePurchaseOrder(body: Record<string, unknown>) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders`, body);
}

export async function updatePipelinePurchaseOrder(id: string, body: Record<string, unknown>) {
  return adminPutJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}`, body);
}

export async function submitPurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/submit`, { remarks });
}

export async function approvePurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/approve`, { remarks });
}

export async function releasePurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/release`, { remarks });
}

export async function cancelPurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/cancel`, { remarks });
}

export async function fetchDispatches(limit = 50) {
  const { data } = await adminGet<DispatchRecord[]>(`${BASE}/dispatches?limit=${limit}`);
  return data ?? [];
}

export async function createDispatch(body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/dispatches`, body);
}

export async function fetchGateEntries(limit = 50) {
  const { data } = await adminGet(`${BASE}/gate-entries?limit=${limit}`);
  return data ?? [];
}

export async function fetchGrns(limit = 50) {
  const { data } = await adminGet(`${BASE}/grns?limit=${limit}`);
  return data ?? [];
}

export async function fetchReceiptQueue() {
  const { data } = await adminGet<StockUnit[]>(`${BASE}/receipts/queue`);
  return data ?? [];
}

export async function createReceipt(body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/receipts`, body);
}

export async function fetchPdiQueue() {
  const { data } = await adminGet<StockUnit[]>(`${BASE}/pdi/queue`);
  return data ?? [];
}

export async function submitPreStockPdi(stockId: string, body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/pdi/${stockId}/pre-stock`, body);
}

export async function fetchRectifications(status?: string) {
  const q = status ? `?status=${status}` : "";
  const { data } = await adminGet(`${BASE}/rectifications${q}`);
  return data ?? [];
}

export async function updateRectification(id: string, body: Record<string, unknown>) {
  return adminPatchJson(`${BASE}/rectifications/${id}`, body);
}

export async function fetchVehicle360(id: string) {
  const { data } = await adminGet(`${BASE}/vehicles/${id}/360`);
  return data;
}

export async function fetchStockConfig() {
  const { data } = await adminGet(`${BASE}/config`);
  return data;
}

export async function updateStockConfig(body: Record<string, unknown>) {
  return adminPutJson(`${BASE}/config`, body);
}

export async function placeHold(stockId: string, body: { holdReason: string; remarks?: string }) {
  return adminPostJson(`${BASE}/vehicles/${stockId}/hold`, body);
}

export async function releaseHold(stockId: string, remarks?: string) {
  return adminPostJson(`${BASE}/vehicles/${stockId}/release-hold`, { remarks });
}

export async function moveStock(stockId: string, body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/vehicles/${stockId}/move`, body);
}

export async function logCharging(stockId: string, body: { socBefore?: number; socAfter?: number; notes?: string }) {
  return adminPostJson(`${BASE}/vehicles/${stockId}/charging`, body);
}
