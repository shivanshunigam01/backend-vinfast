import { API_BASE } from "./apiConfig";
import { clearAdminSession, getAdminToken, getAdminUser, getPortalLoginPath } from "./adminAuth";

export class ApiRequestError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(message: string, status: number, errors?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.errors = errors;
  }
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Public GET — returns `null` on error, missing base, or non-OK (caller keeps UI fallback). */
export async function publicGet<T>(path: string): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const json = await parseJson(res);
    if (!res.ok || json.success === false) return null;
    return json.data as T;
  } catch {
    return null;
  }
}

export type PublicPostResult = {
  data: unknown;
  message?: string;
  meta?: Record<string, unknown>;
};

/** Public (unauthenticated) POST — paths like `/leads`, `/test-drives`. */
export async function publicPost(path: string, body: unknown): Promise<PublicPostResult> {
  if (!API_BASE) {
    throw new ApiRequestError(
      "API is not configured. Set VITE_API_URL in .env (must end with /api/v1).",
      0,
    );
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(
      String(json.message ?? "Request failed"),
      res.status,
      json.errors as ApiRequestError["errors"],
    );
  }
  return {
    data: json.data,
    message: json.message as string | undefined,
    meta: json.meta as Record<string, unknown> | undefined,
  };
}

function mergeAuthHeaders(headers: Headers) {
  const token = getAdminToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
}

export async function adminRequest(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ res: Response; json: Record<string, unknown> }> {
  const { json: jsonBody, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(jsonBody);
  }
  mergeAuthHeaders(headers);
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers, body });
  const json = await parseJson(res);
  if (res.status === 401) {
    const loginPath = getPortalLoginPath(getAdminUser());
    clearAdminSession();
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin") &&
      !window.location.pathname.includes("/admin/login") &&
      !window.location.pathname.includes("/staff/login")
    ) {
      window.location.assign(`${window.location.origin}${loginPath}?reason=session-expired`);
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

export async function adminGet<T>(path: string): Promise<{ data: T; meta?: { page: number; limit: number; total: number } }> {
  const { res, json } = await adminRequest(path);
  assertOk(res, json);
  return { data: json.data as T, meta: json.meta as { page: number; limit: number; total: number } | undefined };
}

export async function adminGetData<T>(path: string): Promise<T> {
  const { data } = await adminGet<T>(path);
  return data;
}

export async function adminPostJson<T>(path: string, body: unknown): Promise<T> {
  const { res, json } = await adminRequest(path, { method: "POST", json: body });
  assertOk(res, json);
  return json.data as T;
}

export async function adminPutJson<T>(path: string, body: unknown): Promise<T> {
  const { res, json } = await adminRequest(path, { method: "PUT", json: body });
  assertOk(res, json);
  return json.data as T;
}

export async function adminPatchJson<T>(path: string, body: unknown): Promise<T> {
  const { res, json } = await adminRequest(path, { method: "PATCH", json: body });
  assertOk(res, json);
  return json.data as T;
}

export async function adminDeleteJson<T = unknown>(path: string): Promise<T | undefined> {
  const { res, json } = await adminRequest(path, { method: "DELETE" });
  assertOk(res, json);
  return json.data as T | undefined;
}

/** Download a binary response (Excel export, etc.) with auth. */
export async function adminDownloadBlob(
  path: string,
  fallbackFilename = "download.bin",
): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers();
  mergeAuthHeaders(headers);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (res.status === 401) {
    const loginPath = getPortalLoginPath(getAdminUser());
    clearAdminSession();
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin") &&
      !window.location.pathname.includes("/admin/login") &&
      !window.location.pathname.includes("/staff/login")
    ) {
      window.location.assign(`${window.location.origin}${loginPath}?reason=session-expired`);
    }
  }
  if (!res.ok) {
    let message = "Download failed";
    try {
      const json = (await res.json()) as { message?: string };
      if (json.message) message = String(json.message);
    } catch {
      /* ignore */
    }
    throw new ApiRequestError(message, res.status);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : fallbackFilename;
  const blob = await res.blob();
  return { blob, filename };
}

/** POST multipart/form-data (do not set Content-Type — browser sets boundary). */
export async function adminPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  mergeAuthHeaders(headers);
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });
  const json = await parseJson(res);
  if (res.status === 401) {
    const loginPath = getPortalLoginPath(getAdminUser());
    clearAdminSession();
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin") &&
      !window.location.pathname.includes("/admin/login") &&
      !window.location.pathname.includes("/staff/login")
    ) {
      window.location.assign(`${window.location.origin}${loginPath}?reason=session-expired`);
    }
  }
  assertOk(res, json);
  return json.data as T;
}

export async function adminLogin(email: string, password: string): Promise<{ token: string; admin: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(
      String(json.message ?? "Login failed"),
      res.status,
      json.errors as ApiRequestError["errors"],
    );
  }
  return { token: json.token as string, admin: json.admin as Record<string, unknown> };
}

/** Staff portal login — TDStaff accounts only. */
export async function staffLogin(email: string, password: string): Promise<{ token: string; admin: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/admin/auth/staff-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(
      String(json.message ?? "Login failed"),
      res.status,
      json.errors as ApiRequestError["errors"],
    );
  }
  return { token: json.token as string, admin: json.admin as Record<string, unknown> };
}

async function staffForgotPost<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE) {
    throw new ApiRequestError(
      "API is not configured. Set VITE_API_URL in .env (must end with /api/v1).",
      0,
    );
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(
      String(json.message ?? "Request failed"),
      res.status,
      json.errors as ApiRequestError["errors"],
    );
  }
  return json.data as T;
}

export async function staffForgotSendOtp(mobile: string) {
  return staffForgotPost<{
    sent: boolean;
    mobileMasked: string;
    resendCooldownSec: number;
    maxAttempts: number;
  }>("/admin/auth/staff-forgot/send-otp", { mobile });
}

export async function staffForgotVerifyOtp(mobile: string, code: string) {
  return staffForgotPost<{ resetToken: string }>("/admin/auth/staff-forgot/verify-otp", {
    mobile,
    code,
  });
}

export async function staffForgotResetPassword(resetToken: string, newPassword: string) {
  return staffForgotPost<{ ok: boolean }>("/admin/auth/staff-forgot/reset", {
    resetToken,
    newPassword,
  });
}

export async function adminMe(): Promise<unknown> {
  const { res, json } = await adminRequest("/admin/auth/me");
  assertOk(res, json);
  return json.data;
}

export function formatApiErrors(err: unknown): string {
  if (err instanceof ApiRequestError && err.errors?.length) {
    return err.errors.map((e) => `${e.field}: ${e.message}`).join("; ");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
