/** Digits-only for wa.me (no +). */
export function whatsappDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Prefilled message when opening WhatsApp from the public site (wa.me `text` param). */
export const DEFAULT_WHATSAPP_OPENING_PROMPT =
  "Hi, I came across VinFast and would like to explore more details.";

/** `https://wa.me/<digits>?text=...` — uses {@link DEFAULT_WHATSAPP_OPENING_PROMPT} unless `text` is `""`. */
export function waMeUrl(digits: string, text: string = DEFAULT_WHATSAPP_OPENING_PROMPT): string {
  const w = whatsappDigits(digits);
  const base = w ? `https://wa.me/${w}` : "https://wa.me/919231445060";
  const t = text.trim();
  if (!t) return base;
  return `${base}?text=${encodeURIComponent(t)}`;
}

/** Build tel: href from a display number like "+91 92314 45060". */
export function telHref(display: string): string {
  const d = display.replace(/\D/g, "");
  if (!d) return "tel:+919231445060";
  if (d.length >= 10 && d.startsWith("91")) return `tel:+${d}`;
  if (d.length === 10) return `tel:+91${d}`;
  return `tel:+${d}`;
}
