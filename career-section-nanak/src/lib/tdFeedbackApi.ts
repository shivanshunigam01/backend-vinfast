import { adminGet, adminRequest } from "./api";

export type TDFeedbackRecord = {
  _id: string;
  bookingId: string;
  drivingExperience?: number;
  vehicleComfort?: number;
  batteryConfidence?: number;
  executiveBehaviour?: number;
  purchaseIntention?: number;
  preferredVariant?: string;
  remarks?: string;
  overallRating?: number;
};

export type TDFeedbackInput = {
  bookingId: string;
  customerId?: string;
  drivingExperience: number;
  vehicleComfort: number;
  batteryConfidence: number;
  executiveBehaviour: number;
  purchaseIntention: number;
  preferredVariant?: string;
  remarks?: string;
};

export async function fetchTDFeedbackByBooking(bookingId: string): Promise<TDFeedbackRecord | null> {
  const { data } = await adminGet<TDFeedbackRecord | null>(`/admin/td/feedback/booking/${bookingId}`);
  return data ?? null;
}

export async function submitTDFeedback(input: TDFeedbackInput): Promise<{ leadId?: string; message?: string }> {
  const { res, json } = await adminRequest("/td/feedback/submit", { method: "POST", json: input });
  if (!res.ok) {
    throw new Error(String(json.message ?? "Could not save feedback"));
  }
  return {
    leadId: json.leadId as string | undefined,
    message: json.message as string | undefined,
  };
}
