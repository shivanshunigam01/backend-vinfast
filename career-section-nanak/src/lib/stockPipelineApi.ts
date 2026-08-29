import { adminGet, adminPostJson, adminPutJson, adminPatchJson, adminDeleteJson } from "@/lib/api";

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
  dispatchedQty?: number;
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
  supplierId?: string | { _id: string; name: string; legalName?: string; gstin?: string; type?: string; code?: string };
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
  poLineId?: string;
  oemInvoiceNumber: string;
  oemInvoiceDate: string;
  dispatchDate: string;
  transporter: string;
  lrNumber: string;
  truckNumber: string;
  driverName?: string;
  driverMobile?: string;
  status: string;
  items: Array<{ vin: string; model: string; variant?: string; colour?: string; configMatch?: string; poLineId?: string }>;
};

export type LineTransport = {
  oemInvoiceNumber: string;
  oemInvoiceDate: string;
  transporter: string;
  lrNumber: string;
  truckNumber: string;
  driverName: string;
  driverMobile: string;
};

export type LineShipmentPayload = LineTransport & {
  poLineId: string;
  items: Array<{
    poLineId: string;
    vin: string;
    model: string;
    variant?: string;
    colour?: string;
    motorNo?: string;
  }>;
};

export function emptyLineTransport(): LineTransport {
  return {
    oemInvoiceNumber: "",
    oemInvoiceDate: new Date().toISOString().slice(0, 10),
    transporter: "VinFast Logistics",
    lrNumber: "",
    truckNumber: "",
    driverName: "",
    driverMobile: "",
  };
}

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
  holdReason?: string;
  holdFeedback?: string;
  lastPdiResult?: string;
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

export async function rejectPurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/reject`, { remarks });
}

export async function releasePurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/release`, { remarks });
}

export async function cancelPurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/cancel`, { remarks });
}

export async function deletePurchaseOrder(id: string) {
  return adminDeleteJson(`${BASE}/purchase-orders/${id}`);
}

export async function fetchDispatches(limit = 50) {
  const { data } = await adminGet<DispatchRecord[]>(`${BASE}/dispatches?limit=${limit}`);
  return data ?? [];
}

export async function createDispatch(body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/dispatches`, body);
}

export async function updateDispatch(id: string, body: Record<string, unknown>) {
  return adminPutJson<DispatchRecord>(`${BASE}/dispatches/${id}`, body);
}

export async function deleteDispatch(id: string) {
  return adminDeleteJson(`${BASE}/dispatches/${id}`);
}

export async function fetchGateEntries(limit = 50) {
  const { data } = await adminGet(`${BASE}/gate-entries?limit=${limit}`);
  return data ?? [];
}

export async function deleteGateEntry(id: string) {
  return adminDeleteJson(`${BASE}/gate-entries/${id}`);
}

export async function fetchGrns(limit = 50) {
  const { data } = await adminGet(`${BASE}/grns?limit=${limit}`);
  return data ?? [];
}

export async function deleteGrn(id: string) {
  return adminDeleteJson(`${BASE}/grns/${id}`);
}

export async function fetchReceiptQueue() {
  const { data } = await adminGet<StockUnit[]>(`${BASE}/receipts/queue`);
  return data ?? [];
}

export async function createReceipt(body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/receipts`, body);
}

export type ReceiptRecord = {
  _id: string;
  receiptNo?: string;
  vin?: string;
  receiptStatus?: string;
  vehicleStockId?: string;
  createdAt?: string;
};

export async function fetchReceipts(limit = 50) {
  const { data } = await adminGet<ReceiptRecord[]>(`${BASE}/receipts?limit=${limit}`);
  return data ?? [];
}

export async function deleteReceipt(id: string) {
  return adminDeleteJson(`${BASE}/receipts/${id}`);
}

export async function fetchPdiQueue() {
  const { data } = await adminGet<StockUnit[]>(`${BASE}/pdi/queue`);
  return data ?? [];
}

export type StockPdiRecord = {
  _id: string;
  pdiNumber?: string;
  type?: string;
  result?: string;
  vin?: string;
  vehicleStockId?: string;
  performedAt?: string;
  notes?: string;
};

export async function fetchPdis(type = "PRE_STOCK") {
  const { data } = await adminGet<StockPdiRecord[]>(`${BASE}/pdi?type=${encodeURIComponent(type)}&limit=50`);
  return data ?? [];
}

export async function submitPreStockPdi(stockId: string, body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/pdi/${stockId}/pre-stock`, body);
}

export async function deletePdi(id: string) {
  return adminDeleteJson(`${BASE}/pdi/${id}`);
}

export async function fetchRectifications(status?: string) {
  const q = status ? `?status=${status}` : "";
  const { data } = await adminGet(`${BASE}/rectifications${q}`);
  return data ?? [];
}

export async function updateRectification(id: string, body: Record<string, unknown>) {
  return adminPatchJson(`${BASE}/rectifications/${id}`, body);
}

export async function deleteRectification(id: string) {
  return adminDeleteJson(`${BASE}/rectifications/${id}`);
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
