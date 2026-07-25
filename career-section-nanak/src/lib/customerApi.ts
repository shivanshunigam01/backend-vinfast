import { API_BASE } from "./apiConfig";
import { ApiRequestError } from "./api";
import {
  clearCustomerSession,
  getCustomerToken,
  type CustomerUser,
} from "./customerAuth";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function customerRequest(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ res: Response; json: Record<string, unknown> }> {
  if (!API_BASE) {
    throw new ApiRequestError("API is not configured.", 0);
  }

  const { json: jsonBody, ...rest } = init;
  const headers = new Headers(rest.headers);
  const token = getCustomerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = rest.body;
  if (jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(jsonBody);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers, body });
  const json = await parseJson(res);

  if (res.status === 401) {
    clearCustomerSession();
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/customer") &&
      !window.location.pathname.includes("/customer/login")
    ) {
      window.location.assign(`${window.location.origin}/customer/login?reason=session-expired`);
    }
  }

  return { res, json };
}

function assertOk(res: Response, json: Record<string, unknown>) {
  if (!res.ok) {
    throw new ApiRequestError(
      String(json.message ?? "Request failed"),
      res.status,
      json.errors as ApiRequestError["errors"],
    );
  }
}

export async function customerCheckMobile(mobile: string): Promise<{ name: string; mobile: string }> {
  const { res, json } = await customerRequest("/customer/auth/check-mobile", {
    method: "POST",
    json: { mobile },
  });
  assertOk(res, json);
  return json.data as { name: string; mobile: string };
}

export async function customerLogin(
  mobile: string,
  options: { whatsappVerificationToken: string },
): Promise<{ token: string; customer: CustomerUser }> {
  const { res, json } = await customerRequest("/customer/auth/login", {
    method: "POST",
    json: {
      mobile,
      whatsappVerificationToken: options.whatsappVerificationToken,
    },
  });
  assertOk(res, json);
  return {
    token: json.token as string,
    customer: json.customer as CustomerUser,
  };
}

export type CustomerBooking = {
  _id: string;
  bookingId: string;
  slotDate: string;
  slotDateLabel?: string | null;
  slotTime: string;
  slotTimeLabel?: string | null;
  bookingStatus: string;
  preferredModel?: string;
  canReschedule?: boolean;
  rescheduleCount?: number;
  hasPendingReschedule?: boolean;
  branchId?: { _id: string; name: string; code: string; city?: string } | null;
  testDriveId?: {
    model?: string;
    variant?: string;
    status?: string;
    preferredTestDriveLocation?: string;
  } | null;
  vehicleId?: { model?: string; registrationNo?: string; color?: string } | null;
  assignedExecutive?: { name?: string } | null;
  remarks?: string;
  createdAt?: string;
};

export type PreferredSlotOption = { slotDate: string; slotTime: string };

export async function fetchCustomerBookings(): Promise<CustomerBooking[]> {
  const { res, json } = await customerRequest("/customer/bookings");
  assertOk(res, json);
  return (json.data as CustomerBooking[]) ?? [];
}

/** MoM #4: submit exactly 3 preferred slots for dealership approval. */
export async function customerRequestReschedule(
  bookingId: string,
  body: { preferredSlots: PreferredSlotOption[]; reason?: string },
): Promise<{ booking: CustomerBooking }> {
  const { res, json } = await customerRequest(`/customer/bookings/${bookingId}/reschedule`, {
    method: "PATCH",
    json: body,
  });
  assertOk(res, json);
  const data = json.data as { booking?: CustomerBooking };
  return { booking: data?.booking ?? (json.data as CustomerBooking) };
}
