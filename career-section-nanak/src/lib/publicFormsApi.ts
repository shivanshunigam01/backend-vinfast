import { publicPost, type PublicPostResult } from "@/lib/api";
import { isPublicFormPostDisabled, PUBLIC_FORM_POST_DISABLED_MESSAGE } from "@/lib/apiConfig";
import { normalizeLeadModel, normalizeTestDriveModel } from "@/lib/apiMappers";
import { leadModelLabel } from "@/data/vinfastModels";

function skipWhenPublicFormPostDisabled(): PublicPostResult {
  return { data: null, message: PUBLIC_FORM_POST_DISABLED_MESSAGE };
}

export async function submitPublicLead(payload: {
  name: string;
  mobile: string;
  city: string;
  otherCity?: string;
  modelDisplay: string;
  /** All selected products (catalog base names). Primary remains `modelDisplay`. */
  interestedModels?: string[];
  source: string;
  remarks?: string;
  interest?: string;
  email?: string;
  financeNeeded?: boolean;
  exchangeNeeded?: boolean;
  pageSource?: string;
  /** Google reCAPTCHA v3 token (required when API has RECAPTCHA_SECRET_KEY). */
  recaptchaToken?: string;
  /** Required when server has WHATSAPP_OTP_ENABLED=true; from WhatsAppOtpVerify. */
  whatsappVerificationToken?: string;
}): Promise<PublicPostResult> {
  if (isPublicFormPostDisabled()) return skipWhenPublicFormPostDisabled();
  const city = payload.city === "Other" ? "Other" : payload.city.trim();
  const otherCity = payload.city === "Other" ? (payload.otherCity || "").trim() : "";
  const model = normalizeLeadModel(payload.modelDisplay);
  const interestedModels = Array.from(
    new Set(
      (payload.interestedModels || [])
        .map((m) => normalizeLeadModel(String(m)))
        .filter((m) => m && m !== "Both"),
    ),
  );
  if (model && model !== "Both" && !interestedModels.includes(model)) {
    interestedModels.unshift(model);
  }
  const trimNote = payload.modelDisplay.trim();
  const multiNote =
    interestedModels.length > 1 ? `Interested models: ${interestedModels.join(", ")}` : "";
  const remarks = [
    payload.remarks,
    trimNote && model !== trimNote ? `Trim: ${trimNote}` : "",
    multiNote,
  ]
    .filter(Boolean)
    .join(" | ");

  const recaptchaToken = payload.recaptchaToken?.trim();
  return publicPost("/leads", {
    name: payload.name.trim(),
    mobile: payload.mobile.trim(),
    email: payload.email?.trim() || undefined,
    city,
    otherCity,
    model,
    interestedModels: interestedModels.length ? interestedModels : undefined,
    interest: payload.interest?.trim() || undefined,
    source: payload.source?.trim() || "Website",
    remarks: remarks || undefined,
    financeNeeded: payload.financeNeeded ?? false,
    exchangeNeeded: payload.exchangeNeeded ?? false,
    pageSource: payload.pageSource,
    ...(recaptchaToken ? { recaptchaToken } : {}),
    ...(payload.whatsappVerificationToken
      ? { whatsappVerificationToken: payload.whatsappVerificationToken }
      : {}),
  });
}

export async function submitPublicTestDrive(payload: {
  customerName: string;
  mobile: string;
  email?: string;
  city?: string;
  model: string;
  variant: string;
  /** All models the customer wants to experience (one TD booking is created per model by the caller). */
  interestedModels?: string[];
  preferredDate: string;
  preferredTime?: string;
  branch?: string;
  remarks?: string;
  pageSource?: string;
  preferredTestDriveLocation: string;
  ownsCar: string;
  currentCarDetails?: string;
  purchaseTimeline: string;
  recaptchaToken?: string;
  whatsappVerificationToken?: string;
}): Promise<PublicPostResult> {
  if (isPublicFormPostDisabled()) return skipWhenPublicFormPostDisabled();
  const display = leadModelLabel(payload.model, payload.variant);
  const model = normalizeTestDriveModel(display);
  const interestedModels = Array.from(
    new Set(
      (payload.interestedModels || [])
        .map((m) => normalizeTestDriveModel(String(m)))
        .filter(Boolean),
    ),
  );
  if (model && !interestedModels.includes(model)) interestedModels.unshift(model);
  const multiNote =
    interestedModels.length > 1 ? `Interested models: ${interestedModels.join(", ")}` : "";
  const recaptchaToken = payload.recaptchaToken?.trim();
  return publicPost("/test-drives", {
    customerName: payload.customerName.trim(),
    mobile: payload.mobile.trim(),
    email: payload.email?.trim() || undefined,
    model,
    models: interestedModels.length ? interestedModels : [model],
    interestedModels: interestedModels.length ? interestedModels : undefined,
    city: payload.city?.trim() || undefined,
    preferredDate: payload.preferredDate,
    preferredTime: payload.preferredTime?.trim() || undefined,
    branch: payload.branch?.trim() || undefined,
    preferredTestDriveLocation: payload.preferredTestDriveLocation,
    ownsCar: payload.ownsCar,
    currentCarDetails:
      payload.ownsCar === "Yes" ? payload.currentCarDetails?.trim() || undefined : undefined,
    purchaseTimeline: payload.purchaseTimeline,
    remarks:
      [payload.remarks?.trim(), `Trim: ${display}`, multiNote].filter(Boolean).join(" | ") ||
      undefined,
    pageSource: payload.pageSource,
    ...(recaptchaToken ? { recaptchaToken } : {}),
    ...(payload.whatsappVerificationToken
      ? { whatsappVerificationToken: payload.whatsappVerificationToken }
      : {}),
  });
}

export async function submitPublicEnquiry(payload: {
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  model?: string;
  variant?: string;
  interestedModels?: string[];
  interest: string;
  message?: string;
  source?: string;
  recaptchaToken?: string;
  whatsappVerificationToken?: string;
}): Promise<PublicPostResult> {
  if (isPublicFormPostDisabled()) return skipWhenPublicFormPostDisabled();
  const display = payload.model && payload.variant !== undefined ? leadModelLabel(payload.model, payload.variant) : "";
  const interestedModels = Array.from(
    new Set((payload.interestedModels || []).map((m) => String(m).trim()).filter(Boolean)),
  );
  const multiNote =
    interestedModels.length > 1 ? `Interested models: ${interestedModels.join(", ")}` : "";
  const recaptchaToken = payload.recaptchaToken?.trim();
  return publicPost("/enquiries", {
    name: payload.name.trim(),
    mobile: payload.mobile.trim(),
    email: payload.email?.trim() || undefined,
    city: payload.city?.trim() || undefined,
    model: display ? normalizeTestDriveModel(display) : undefined,
    interestedModels: interestedModels.length ? interestedModels : undefined,
    interest: payload.interest,
    message: [payload.message?.trim(), multiNote].filter(Boolean).join(" | ") || undefined,
    source: payload.source ?? "Contact Form",
    ...(recaptchaToken ? { recaptchaToken } : {}),
    ...(payload.whatsappVerificationToken
      ? { whatsappVerificationToken: payload.whatsappVerificationToken }
      : {}),
  });
}
