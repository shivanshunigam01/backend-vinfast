/**
 * Public + admin API base (must include `/api/v1`).
 *
 * Default: live backend `https://apivnfast.patliputragroup.com/api/v1`.
 * Override with `VITE_API_URL` in `.env.development` (e.g. `http://localhost:2000/api/v1`).
 */
export const LIVE_API_BASE = "https://apivnfast.patliputragroup.com/api/v1";

/** Local backend — set `VITE_API_URL` to this when running `backend` on your machine. */
export const LOCAL_API_BASE = "http://localhost:2000/api/v1";

function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "").trim();
  return fromEnv || LIVE_API_BASE;
}

export const API_BASE = resolveApiBase();

export function hasApi(): boolean {
  return Boolean(API_BASE);
}

/** Admin-facing email alerts from form submissions are disabled; WhatsApp OTP still calls the API. */
export const PUBLIC_FORM_POST_DISABLED_MESSAGE =
  "Online lead submission is paused. WhatsApp verification still works.";

/** Default: public POST /leads, /test-drives, /enquiries are skipped. Set `VITE_PUBLIC_FORM_POST_DISABLED=false` to turn submissions back on. */
export function isPublicFormPostDisabled(): boolean {
  return import.meta.env.VITE_PUBLIC_FORM_POST_DISABLED !== "false";
}
