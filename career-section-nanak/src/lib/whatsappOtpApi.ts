import { publicPost } from "@/lib/api";

export async function sendWhatsAppOtp(payload: {
  mobile: string;
  name?: string;
  recaptchaToken?: string;
}) {
  return publicPost("/whatsapp-otp/send", payload);
}

export async function verifyWhatsAppOtp(payload: { mobile: string; code: string }) {
  return publicPost("/whatsapp-otp/verify", payload);
}
