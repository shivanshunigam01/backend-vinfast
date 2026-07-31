import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Phone, ShieldCheck, ArrowRight, MessageCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import vinLogo from "@/assets/patliputra-vinfast-logo.png";
import { hasApi } from "@/lib/apiConfig";
import { ApiRequestError, formatApiErrors } from "@/lib/api";
import { customerCheckMobile, customerLogin } from "@/lib/customerApi";
import { setCustomerSession } from "@/lib/customerAuth";
import { sendWhatsAppOtp, verifyWhatsAppOtp } from "@/lib/whatsappOtpApi";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";

const MOBILE_OK = /^[6-9]\d{9}$/;

function isValidOtpInput(digits: string): boolean {
  return digits.length === 4;
}

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const { getToken } = usePublicFormRecaptcha();

  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const sendLoginOtp = async (mobile10: string, name: string) => {
    let recaptchaToken: string | undefined;
    try {
      recaptchaToken = await getToken("customer_login_whatsapp_otp");
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Security verification failed.");
    }
    await sendWhatsAppOtp({
      mobile: mobile10,
      name: name.trim() || "Customer",
      recaptchaToken,
    });
  };

  const handleCheckMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    const mobile10 = mobile.trim();
    if (!MOBILE_OK.test(mobile10)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!hasApi()) {
      setError("Online login is unavailable. Please contact the showroom.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await customerCheckMobile(mobile10);
      setCustomerName(data.name);
      await sendLoginOtp(mobile10, data.name);
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiRequestError ? formatApiErrors(err) : err instanceof Error ? err.message : "Could not verify mobile number");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!MOBILE_OK.test(mobile.trim())) return;
    setResending(true);
    setError("");
    try {
      await sendLoginOtp(mobile.trim(), customerName);
    } catch (err) {
      setError(err instanceof ApiRequestError ? formatApiErrors(err) : err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = otp.replace(/\D/g, "").slice(0, 4);
    if (!isValidOtpInput(digits)) {
      setError("Enter the 4-digit WhatsApp code");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await verifyWhatsAppOtp({ mobile: mobile.trim(), code: digits });
      const verificationToken = (data as { verificationToken?: string })?.verificationToken;
      if (!verificationToken) {
        setError("Verification failed. Try again.");
        return;
      }

      const { token, customer } = await customerLogin(mobile.trim(), {
        whatsappVerificationToken: verificationToken,
      });
      setCustomerSession(token, customer);
      navigate("/customer/bookings", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? formatApiErrors(err) : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
            <div className="text-center mb-8">
              <img
                src={vinLogo}
                alt="Patliputra VinFast"
                className="mx-auto mb-4 h-14 w-auto object-contain"
              />
              <h1 className="font-display text-2xl font-bold text-foreground">Customer Login</h1>
              <p className="text-sm text-muted-foreground mt-2">
                View and manage your test drive bookings using the mobile number from your booking form.
              </p>
            </div>

            {sessionExpired ? (
              <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                Your session expired. Please log in again.
              </div>
            ) : null}

            {error ? (
              <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {step === "mobile" ? (
              <form onSubmit={handleCheckMobile} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="customer-mobile">Mobile number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="customer-mobile"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="pl-10 h-12"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use the same number you entered on the test drive booking form. We&apos;ll send a WhatsApp OTP to verify it.
                  </p>
                </div>
                <Button type="submit" className="w-full h-12" disabled={loading || !MOBILE_OK.test(mobile)}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Continue
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm">
                  <p className="font-medium text-foreground">{customerName || "Customer"}</p>
                  <p className="text-muted-foreground">+91 {mobile}</p>
                  <button
                    type="button"
                    className="text-primary text-xs mt-1 hover:underline"
                    onClick={() => {
                      setStep("mobile");
                      setOtp("");
                      setError("");
                    }}
                  >
                    Change number
                  </button>
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3 flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A one-time code was sent to your WhatsApp on this number — same verification used on the test drive form.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-otp">WhatsApp OTP</Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="customer-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="pl-10 h-12"
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Enter the 4-digit code from WhatsApp.</p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                      disabled={resending || loading}
                      onClick={() => void handleResendOtp()}
                    >
                      {resending ? "Resending…" : "Resend code"}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12" disabled={loading || !isValidOtpInput(otp)}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Login
                </Button>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground mt-6">
              Haven&apos;t booked yet?{" "}
              <Link to="/test-drive" className="text-primary hover:underline">
                Book a test drive
              </Link>
            </p>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Employee?{" "}
              <Link to="/staff/login" className="text-primary hover:underline">
                Login as Employee
              </Link>
              {" · "}
              <Link to="/admin/login" className="text-primary hover:underline">
                Login as Admin
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
