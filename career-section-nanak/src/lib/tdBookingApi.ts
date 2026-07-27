import { adminGet, adminPostJson, adminRequest, formatApiErrors, ApiRequestError } from "@/lib/api";

export type TdBookingDlFields = {
  dlVerified: boolean;
  dlImageUrl?: string | null;
  dlVerifiedAt?: string | null;
  dlNumber?: string | null;
  dlValidUntil?: string | null;
};

export async function verifyTdBookingDrivingLicence(
  bookingId: string,
  payload: { file?: File | null; dlNumber: string; dlValidUntil: string },
): Promise<TdBookingDlFields & { _id: string }> {
  const fd = new FormData();
  // Image is required on first verification; optional when re-editing (existing image is kept).
  if (payload.file) fd.append("dlImage", payload.file);
  fd.append("dlNumber", payload.dlNumber.trim());
  fd.append("dlValidUntil", payload.dlValidUntil);

  const { res, json } = await adminRequest(`/admin/td/bookings/${bookingId}/verify-dl`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    throw new ApiRequestError(
      String(json.message ?? "Could not verify driving licence"),
      res.status,
      json.errors as ApiRequestError["errors"],
    );
  }

  return json.data as TdBookingDlFields & { _id: string };
}

export type TdBookingBrief = {
  bookingId: string;
  bookingStatus: string;
  preferredModel?: string;
  slotDate?: string;
  slotTime?: string;
  isRepeatDrive?: boolean;
};

export type TdBookingEligibility = {
  mobile: string;
  model: string | null;
  activeSameModel: TdBookingBrief | null;
  completedSameModel: TdBookingBrief | null;
  completedAny: TdBookingBrief | null;
  /** True when this model was already test-driven — repeat needs manager/superadmin. */
  requiresApproval: boolean;
  canApproveRepeat: boolean;
  bookings: TdBookingBrief[];
};

/** Repeat/duplicate check before booking a test drive for a customer. */
export async function checkTdBookingEligibility(mobile: string, model?: string): Promise<TdBookingEligibility> {
  const q = new URLSearchParams({ mobile });
  if (model) q.set("model", model);
  const { data } = await adminGet<TdBookingEligibility>(`/admin/td/bookings/eligibility?${q}`);
  return data;
}

export type CreateStaffBookingPayload = {
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  customerCity?: string;
  preferredModel: string;
  slotDate: string;
  slotTime: string;
  remarks?: string;
  /** CRM lead to link + move to "Test Drive Booked". */
  leadId?: string;
};

/** Staff-created test drive booking (repeats after completion need manager/superadmin). */
export async function createStaffTdBooking(payload: CreateStaffBookingPayload): Promise<{ _id: string; bookingId: string }> {
  return adminPostJson<{ _id: string; bookingId: string }>("/admin/td/bookings", payload);
}

export { formatApiErrors };
