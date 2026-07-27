import { publicGet } from "@/lib/api";
import { API_BASE } from "@/lib/apiConfig";

export type PublicTdBranch = {
  _id: string;
  name: string;
  code: string;
  city?: string;
  phone?: string;
};

export type PublicTdSlot = {
  time: string;
  label?: string;
  available: boolean;
  bookings: number;
  maxBookings: number;
  fleetAvailable?: number;
  past?: boolean;
  reason?: "past" | "no_fleet" | "full" | "blocked" | "not_offered" | null;
  bookable?: boolean;
};

export function slotStatusLabel(slot: PublicTdSlot): string | null {
  if (slot.available) return null;
  switch (slot.reason) {
    case "full":
      return "Full";
    case "past":
      return "Past";
    case "no_fleet":
      return "No car";
    case "blocked":
      return "Closed";
    case "not_offered":
      return "Unavailable";
    default:
      return "Unavailable";
  }
}

export type PublicTdSlotsResponse = {
  slots: PublicTdSlot[];
  slotDuration?: number;
  workingStartTime?: string;
  workingEndTime?: string;
  fleetAvailable?: number;
  fleetCapacity?: number;
  maxConcurrentBookings?: number;
  message?: string;
};

export async function fetchPublicTdBranches(): Promise<PublicTdBranch[]> {
  const data = await publicGet<PublicTdBranch[]>("/public/td/branches");
  return data ?? [];
}

export async function fetchPublicTdSlots(params: {
  branchId: string;
  date: string;
  model?: string;
  variant?: string;
}): Promise<PublicTdSlotsResponse> {
  const q = new URLSearchParams({
    branchId: params.branchId,
    date: params.date,
  });
  if (params.model) q.set("model", params.model);
  if (params.variant) q.set("variant", params.variant);

  if (!API_BASE) {
    return { slots: [] };
  }

  try {
    const res = await fetch(`${API_BASE}/public/td/slots/available?${q}`);
    const json = (await res.json()) as {
      success?: boolean;
      data?: PublicTdSlot[];
      message?: string;
      slotDuration?: number;
      bufferTime?: number;
      workingStartTime?: string;
      workingEndTime?: string;
      fleetAvailable?: number;
      fleetCapacity?: number;
      maxConcurrentBookings?: number;
    };
    if (!res.ok || json.success === false) {
      return { slots: [], message: json.message ?? "Could not load time slots" };
    }
    return {
      slots: json.data ?? [],
      message: json.message,
      slotDuration: json.slotDuration,
      bufferTime: json.bufferTime,
      workingStartTime: json.workingStartTime,
      workingEndTime: json.workingEndTime,
      fleetAvailable: json.fleetCapacity ?? json.fleetAvailable,
      fleetCapacity: json.fleetCapacity ?? json.fleetAvailable,
      maxConcurrentBookings: json.maxConcurrentBookings,
    };
  } catch {
    return { slots: [], message: "Could not load time slots" };
  }
}

/** Display "10:00 AM" from API slot (24h or label). */
export function formatSlotLabel(slot: PublicTdSlot): string {
  if (slot.label) return slot.label;
  const [hStr, m] = slot.time.split(":");
  let h = parseInt(hStr, 10);
  const mer = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${mer}`;
}
