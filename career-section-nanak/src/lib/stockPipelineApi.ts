import { adminGet, adminPostJson, adminPutJson, adminPatchJson, adminDeleteJson, adminPostFormData } from "@/lib/api";

const BASE = "/admin/stock/pipeline";

export type PoLine = {
  _id?: string;
  requisitionId?: string;
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
  externalPoNumber?: string;
  externalPoDate?: string;
  sourceSystem?: string;
  externalDocumentUrl?: string;
  requisitionIds?: string[];
  amendmentVersion?: number;
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

export async function createPoFromRequisitions(body: Record<string, unknown>) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/from-requisitions`, body);
}

export async function closePurchaseOrder(id: string, remarks?: string) {
  return adminPostJson<PurchaseOrder>(`${BASE}/purchase-orders/${id}/close`, { remarks });
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

export async function updateGateEntry(id: string, body: Record<string, unknown>) {
  return adminPutJson(`${BASE}/gate-entries/${id}`, body);
}

export async function deleteGateEntry(id: string) {
  return adminDeleteJson(`${BASE}/gate-entries/${id}`);
}

export async function createGateEntry(formData: FormData) {
  return adminPostFormData(`${BASE}/gate-entries`, formData);
}

export async function fetchGrns(limit = 50) {
  const { data } = await adminGet(`${BASE}/grns?limit=${limit}`);
  return data ?? [];
}

export async function updateGrn(id: string, body: Record<string, unknown>) {
  return adminPutJson(`${BASE}/grns/${id}`, body);
}

export async function deleteGrn(id: string) {
  return adminDeleteJson(`${BASE}/grns/${id}`);
}

export async function createGrn(formData: FormData) {
  return adminPostFormData(`${BASE}/grns`, formData);
}

export async function createGrnRecord(body: Record<string, unknown>) {
  return adminPostJson(`${BASE}/grns`, body);
}

export type StockRequisition = {
  _id: string;
  requisitionNo: string;
  version?: number;
  model: string;
  variant?: string;
  colour?: string;
  qty: number;
  orderedQty?: number;
  priority: string;
  neededBy?: string;
  receivingLocation?: string;
  purpose?: string;
  justification?: string;
  indicativeAmount?: number;
  planReference?: string;
  status: string;
  remarks?: string;
  requestedBy?: { _id?: string; name?: string; email?: string; designation?: string } | string;
  recommendedBy?: { _id?: string; name?: string; email?: string } | string;
  approvedBy?: { _id?: string; name?: string; email?: string } | string;
  linkedPoId?: { _id?: string; poNumber?: string; status?: string; externalPoNumber?: string } | string;
  linkedPoIds?: Array<{ _id?: string; poNumber?: string; status?: string } | string>;
  approvalHistory?: Array<{ action: string; status: string; byName?: string; at?: string; remarks?: string }>;
  submittedAt?: string;
  recommendedAt?: string;
  approvedAt?: string;
  createdAt?: string;
};

export async function fetchRequisitions(params?: { status?: string; limit?: number; search?: string }) {
  const q = new URLSearchParams({ limit: String(params?.limit ?? 50) });
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  const { data } = await adminGet<StockRequisition[]>(`${BASE}/requisitions?${q}`);
  return data ?? [];
}

export async function createRequisition(body: Record<string, unknown>) {
  return adminPostJson<StockRequisition>(`${BASE}/requisitions`, body);
}

export async function updateRequisition(id: string, body: Record<string, unknown>) {
  return adminPutJson<StockRequisition>(`${BASE}/requisitions/${id}`, body);
}

export async function submitRequisition(id: string) {
  return adminPostJson<StockRequisition>(`${BASE}/requisitions/${id}/submit`, {});
}

export async function recommendRequisition(id: string, remarks?: string) {
  return adminPostJson<StockRequisition>(`${BASE}/requisitions/${id}/recommend`, { remarks });
}

export async function returnRequisition(id: string, remarks: string) {
  return adminPostJson<StockRequisition>(`${BASE}/requisitions/${id}/return`, { remarks });
}

export async function rejectRequisition(id: string, remarks: string) {
  return adminPostJson<StockRequisition>(`${BASE}/requisitions/${id}/reject`, { remarks });
}

export async function approveRequisition(id: string, body?: { remarks?: string }) {
  return adminPostJson<StockRequisition>(`${BASE}/requisitions/${id}/approve`, body ?? {});
}

export async function deleteRequisition(id: string) {
  return adminDeleteJson(`${BASE}/requisitions/${id}`);
}

export type StockTransfer = {
  _id: string;
  vin?: string;
  transferType?: string;
  fromLocation?: string;
  toLocation?: string;
  toDealerName?: string;
  remarks?: string;
  createdAt?: string;
  vehicleStockId?: StockUnit | string;
  movedBy?: { name?: string; email?: string } | string;
  fromBranchId?: { name?: string; code?: string } | string;
  toBranchId?: { name?: string; code?: string } | string;
};

export async function fetchTransfers(limit = 50) {
  const { data } = await adminGet<StockTransfer[]>(`${BASE}/transfers?limit=${limit}`);
  return data ?? [];
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

export const TECHNICAL_HOLD_CATEGORIES = [
  "ELECTRICAL",
  "MECHANICAL",
  "SOFTWARE",
  "BATTERY_HV",
  "BODY",
  "DIAGNOSTIC",
  "OTHER",
] as const;

export async function placeHold(
  stockId: string,
  body: {
    holdReason: string;
    remarks?: string;
    otherOemDetails?: string;
    technicalHoldCategory?: string;
  },
) {
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
