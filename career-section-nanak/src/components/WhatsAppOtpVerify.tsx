import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendWhatsAppOtp, verifyWhatsAppOtp } from "@/lib/whatsappOtpApi";
import { formatApiErrors } from "@/lib/api";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";

const MOBILE_OK = /^[6-9]\d{9}$/;

function isValidOtpInput(digits: string): boolean {
  return digits.length === 4;
}

type WhatsAppOtpVerifyProps = {
  /** 10-digit Indian mobile (digits only). */
  mobile: string;
  /** Full name from the form (sent as `name` to /whatsapp-otp/send for the template). */
  displayName: string;
  /** reCAPTCHA v3 action name for send endpoint. */
  recaptchaAction: string;
  /** When false, render nothing. */
  enabled: boolean;
  /** Called with JWT after successful verify; null when mobile changes or reset. */
  onTokenChange: (token: string | null) => void;
  className?: string;
};

/**
 * WhatsApp OTP gate for public forms when API exposes `siteConfig.features.whatsappOtp`.
 */
export function WhatsAppOtpVerify({
  mobile,
  displayName,
  recaptchaAction,
  enabled,
  onTokenChange,
  className = "",
}: WhatsAppOtpVerifyProps) {
  const { getToken } = usePublicFormRecaptcha();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    setCode("");
    setSent(false);
    setVerified(false);
    setCooldownSec(0);
    onTokenChange(null);
  }, [mobile, onTokenChange]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldownSec]);

  const otpGateActive = enabled && !verified;

  const mobileOk = MOBILE_OK.test(mobile);

  const handleSend = async () => {
    if (!mobileOk) {
      toast.error("Enter a valid 10-digit mobile number first.");
      return;
    }
    setSending(true);
    try {
      let recaptchaToken: string | undefined;
      try {
        recaptchaToken = await getToken(recaptchaAction);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Security verification failed.");
        return;
      }
      await sendWhatsAppOtp({
        mobile,
        name: displayName.trim() || "Customer",
        recaptchaToken,
      });
      setSent(true);
      setCooldownSec(60);
      toast.success("Check WhatsApp for your verification code.");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    const digits = code.replace(/\D/g, "").slice(0, 4);
    if (!isValidOtpInput(digits)) {
      toast.error("Enter the 4-digit WhatsApp code.");
      return;
    }
    setVerifying(true);
    try {
      const { data } = await verifyWhatsAppOtp({ mobile, code: digits });
      const raw = data as { verificationToken?: string };
      const token = raw?.verificationToken;
      if (!token) {
        toast.error("Verification failed. Try again.");
        return;
      }
      setVerified(true);
      onTokenChange(token);
      toast.success("Mobile verified.");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setVerifying(false);
    }
  };

  if (!enabled) return null;

  return (
    <div
      className={`rounded-xl border border-primary/25 bg-primary/[0.06] p-4 space-y-3 ${className}`}
      role="region"
      aria-label="WhatsApp verification"
    >
      <div className="flex items-start gap-2">
        <MessageCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Verify with WhatsApp</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            We&apos;ll send a one-time code to your WhatsApp on this number so we know it&apos;s really you.
          </p>
          {otpGateActive ? (
            <p
              className="text-xs text-amber-800 dark:text-amber-200/90 mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 leading-snug"
              role="status"
            >
              The main form submit button stays disabled until you verify the code here first.
            </p>
          ) : null}
        </div>
      </div>

      {!verified ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!mobileOk || sending || cooldownSec > 0}
            onClick={() => void handleSend()}
            className="shrink-0 border-primary/40"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : cooldownSec > 0 ? (
              `Resend in ${cooldownSec}s`
            ) : sent ? (
              "Resend code"
            ) : (
              "Send code on WhatsApp"
            )}
          </Button>
          {mobileOk && (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="WhatsApp code"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="sm:max-w-[9rem] bg-background/80"
                aria-label="WhatsApp verification code"
                aria-required="true"
              />
              <Button
                type="button"
                size="sm"
                disabled={verifying || !isValidOtpInput(code.replace(/\D/g, ""))}
                onClick={() => void handleVerify()}
                className="bg-primary text-primary-foreground shrink-0"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
              </Button>
              <p className="w-full text-[11px] text-muted-foreground leading-snug">
                {sent
                  ? "Enter the code from WhatsApp, then tap Verify before submitting the form."
                  : "Send a code on WhatsApp, or enter your verification code and tap Verify."}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden />
          <span>Mobile verified — you can submit the form.</span>
        </div>
      )}
    </div>
  );
}
