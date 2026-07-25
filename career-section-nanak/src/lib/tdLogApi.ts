import { adminGet, adminPostJson, adminRequest, ApiRequestError } from "@/lib/api";

export type TDLogRecord = {
  _id: string;
  bookingId: string;
  openingOdometer?: number;
  closingOdometer?: number;
  totalKM?: number;
  openingBattery?: number;
  closingBattery?: number;
  durationMinutes?: number;
  status: "STARTED" | "COMPLETED" | "ABORTED";
  startTime?: string;
  endTime?: string;
  executiveRemarks?: string;
  customerPhotoUrl?: string;
  vehiclePhotoUrl?: string;
  endLocation?: { lat?: number; lng?: number; accuracy?: number; capturedAt?: string };
  dlNumber?: string;
  dlValidUntil?: string;
  dlImageUrl?: string;
};

export async function fetchTdLogByBooking(bookingId: string): Promise<TDLogRecord | null> {
  const { data } = await adminGet<TDLogRecord[]>(`/admin/td/logs?bookingId=${bookingId}`);
  const logs = data ?? [];
  return logs[0] ?? null;
}

export async function startTestDriveLog(payload: {
  bookingId: string;
  openingOdometer: number;
  openingBattery?: number;
}): Promise<TDLogRecord> {
  return adminPostJson<TDLogRecord>("/admin/td/logs/start", payload);
}

export type EndTestDrivePayload = {
  closingOdometer: number;
  closingBattery?: number;
  executiveRemarks?: string;
  /** Required by the server unless already captured on the log. */
  customerPhoto?: File | null;
  vehiclePhoto?: File | null;
  endLat?: number;
  endLng?: number;
  endAccuracy?: number;
};

export async function endTestDriveLog(logId: string, payload: EndTestDrivePayload): Promise<TDLogRecord> {
  const fd = new FormData();
  fd.append("closingOdometer", String(payload.closingOdometer));
  if (payload.closingBattery != null) fd.append("closingBattery", String(payload.closingBattery));
  if (payload.executiveRemarks) fd.append("executiveRemarks", payload.executiveRemarks);
  if (payload.customerPhoto) fd.append("customerPhoto", payload.customerPhoto);
  if (payload.vehiclePhoto) fd.append("vehiclePhoto", payload.vehiclePhoto);
  if (payload.endLat != null && payload.endLng != null) {
    fd.append("endLat", String(payload.endLat));
    fd.append("endLng", String(payload.endLng));
    if (payload.endAccuracy != null) fd.append("endAccuracy", String(payload.endAccuracy));
  }

  const { res, json } = await adminRequest(`/admin/td/logs/${logId}/end`, {
    method: "PATCH",
    body: fd,
  });
  if (!res.ok) {
    throw new ApiRequestError(
      String(json.message ?? "Could not complete the test drive"),
      res.status,
      json.errors as ApiRequestError["errors"],
    );
  }
  return json.data as TDLogRecord;
}
