import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, ArrowLeft, Users, Phone } from "lucide-react";
import vinfastLogo from "@/assets/patliputra-vinfast-logo.png";
import patliputraOutlineLogo from "@/assets/black outline logo patliputra.png";
import { hasApi } from "@/lib/apiConfig";
import {
  staffLogin,
  staffForgotSendOtp,
  staffForgotVerifyOtp,
  staffForgotResetPassword,
  ApiRequestError,
  formatApiErrors,
} from "@/lib/api";
import { markAdminSessionStart, setAdminSession, getAdminLoginRedirect, type AdminUser } from "@/lib/adminAuth";

type LoginStep = "identity" | "password";
type ForgotStep = "mobile" | "otp" | "newPassword" | "done";

/**
 * Staff portal login — TDStaff accounts only (CRM / Test Drive team).
 * Isolated from Admin portal authentication.
 */
const StaffLogin = () => {
  const [step, setStep] = useState<LoginStep>("identity");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("mobile");
  const [forgotMobile, setForgotMobile] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNew, setShowForgotNew] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [mobileMasked, setMobileMasked] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";

  const continueIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter your registered employee email to continue");
      return;
    }
    setError("");
    setStep("password");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    if (hasApi()) {
      setLoading(true);
      setError("");
      try {
        const { token, admin } = await staffLogin(email.trim(), password);
        const user: AdminUser = {
          ...(admin as AdminUser),
          userType: "tdstaff",
        };
        setAdminSession(token, user);
        navigate(getAdminLoginRedirect(user));
      } catch (err) {
        setError(err instanceof ApiRequestError ? formatApiErrors(err) : "Invalid email or password");
      } finally {
        setLoading(false);
      }
      return;
    }

    localStorage.setItem("admin_logged_in", "true");
    markAdminSessionStart();
    navigate("/admin/my-dashboard");
  };

  const openForgot = () => {
    setForgotMode(true);
    setForgotStep("mobile");
    setForgotMobile("");
    setForgotOtp("");
    setForgotResetToken("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setMobileMasked("");
    setError("");
  };

  const closeForgot = () => {
    setForgotMode(false);
    setForgotStep("mobile");
    setError("");
    setStep("password");
  };

  const sendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const mobile10 = forgotMobile.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile10)) {
      setError("Enter your registered 10-digit WhatsApp mobile number");
      return;
    }
    if (!hasApi()) {
      setError("API is not configured");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await staffForgotSendOtp(mobile10);
      setForgotMobile(mobile10);
      setMobileMasked(data.mobileMasked || `${mobile10.slice(0, 2)}******${mobile10.slice(-2)}`);
      setForgotStep("otp");
      setForgotOtp("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? formatApiErrors(err) : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = forgotOtp.replace(/\D/g, "");
    if (code.length !== 4) {
      setError("Enter the 4-digit OTP from WhatsApp");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await staffForgotVerifyOtp(forgotMobile, code);
      setForgotResetToken(data.resetToken);
      setForgotStep("newPassword");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? formatApiErrors(err) : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const saveForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotNewPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await staffForgotResetPassword(forgotResetToken, forgotNewPassword);
      setForgotStep("done");
    } catch (err) {
      setError(err instanceof ApiRequestError ? formatApiErrors(err) : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  const forgotSubtitle =
    forgotStep === "mobile"
      ? "Enter your registered WhatsApp mobile to receive an OTP"
      : forgotStep === "otp"
        ? `Enter the OTP sent to ${mobileMasked || "your WhatsApp"}`
        : forgotStep === "newPassword"
          ? "Set a new password for your employee account"
          : "Password updated — you can sign in now";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-border/60 bg-card/95 p-8 sm:p-10 shadow-sm backdrop-blur">
          <div className="text-center mb-8">
            <Link
              to="/"
              className="mx-auto mb-4 flex w-full min-w-0 max-w-full items-center justify-center gap-2 px-1"
            >
              <img
                src={vinfastLogo}
                alt="Patliputra VinFast"
                className="h-10 w-auto max-w-[min(48%,11rem)] shrink object-contain object-left sm:h-12"
              />
              <span className="h-7 w-px shrink-0 bg-border sm:h-8" aria-hidden />
              <img
                src={patliputraOutlineLogo}
                alt="Patliputra Group"
                className="h-7 w-auto max-w-[min(42%,9rem)] shrink-0 object-contain object-left sm:h-8"
              />
            </Link>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary mb-3">
              <Users className="h-3.5 w-3.5" />
              Employee portal
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {forgotMode ? "Reset password" : "Employee Login"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {forgotMode
                ? forgotSubtitle
                : step === "identity"
                  ? "Step 1 of 2 — enter your registered employee email"
                  : "Step 2 of 2 — enter your password"}
            </p>
          </div>

          {sessionExpired && !forgotMode && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              Your session has expired (after 1 hour). Please sign in again to continue.
            </div>
          )}

          <AnimatePresence mode="wait">
            {forgotMode ? (
              forgotStep === "mobile" ? (
                <motion.form
                  key="forgot-mobile"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  onSubmit={(e) => void sendForgotOtp(e)}
                  className="space-y-5"
                >
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="forgot-mobile" className="text-sm text-muted-foreground">
                      WhatsApp mobile
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="forgot-mobile"
                        type="tel"
                        inputMode="numeric"
                        placeholder="10-digit mobile"
                        value={forgotMobile}
                        onChange={(e) => {
                          setForgotMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                          setError("");
                        }}
                        className="pl-10 bg-secondary/50 border-border/50"
                        maxLength={10}
                        autoFocus
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full font-semibold py-5">
                    {loading ? "Sending OTP…" : "Send OTP on WhatsApp"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-sm text-primary inline-flex items-center justify-center gap-1"
                    onClick={closeForgot}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to login
                  </button>
                </motion.form>
              ) : forgotStep === "otp" ? (
                <motion.form
                  key="forgot-otp"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  onSubmit={(e) => void verifyForgotOtp(e)}
                  className="space-y-5"
                >
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="forgot-otp" className="text-sm text-muted-foreground">
                      4-digit OTP
                    </Label>
                    <Input
                      id="forgot-otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="••••"
                      value={forgotOtp}
                      onChange={(e) => {
                        setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 4));
                        setError("");
                      }}
                      className="bg-secondary/50 border-border/50 tracking-[0.4em] text-center font-mono text-lg"
                      maxLength={4}
                      autoFocus
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full font-semibold py-5">
                    {loading ? "Verifying…" : "Verify OTP"}
                  </Button>
                  <div className="flex flex-col gap-2 text-sm">
                    <button
                      type="button"
                      className="text-primary"
                      disabled={loading}
                      onClick={() => void sendForgotOtp({ preventDefault() {} } as React.FormEvent)}
                    >
                      Resend OTP
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground inline-flex items-center justify-center gap-1"
                      onClick={() => {
                        setForgotStep("mobile");
                        setError("");
                      }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Change number
                    </button>
                  </div>
                </motion.form>
              ) : forgotStep === "newPassword" ? (
                <motion.form
                  key="forgot-new"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  onSubmit={(e) => void saveForgotPassword(e)}
                  className="space-y-5"
                >
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="forgot-new-password" className="text-sm text-muted-foreground">
                      New password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="forgot-new-password"
                        type={showForgotNew ? "text" : "password"}
                        placeholder="Min 8 characters"
                        value={forgotNewPassword}
                        onChange={(e) => {
                          setForgotNewPassword(e.target.value);
                          setError("");
                        }}
                        className="pl-10 pr-10 bg-secondary/50 border-border/50"
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNew((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showForgotNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-confirm-password" className="text-sm text-muted-foreground">
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="forgot-confirm-password"
                        type={showForgotConfirm ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={forgotConfirmPassword}
                        onChange={(e) => {
                          setForgotConfirmPassword(e.target.value);
                          setError("");
                        }}
                        className="pl-10 pr-10 bg-secondary/50 border-border/50"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showForgotConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full font-semibold py-5">
                    {loading ? "Saving…" : "Save new password"}
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="forgot-done"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-5 text-center"
                >
                  <p className="text-sm text-muted-foreground">
                    Your password was updated. Sign in with your email and new password.
                  </p>
                  <Button
                    type="button"
                    className="w-full font-semibold py-5"
                    onClick={() => {
                      setForgotMode(false);
                      setPassword("");
                      setStep("password");
                      setError("");
                    }}
                  >
                    Back to sign in
                  </Button>
                </motion.div>
              )
            ) : step === "identity" ? (
              <motion.form
                key="identity"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                onSubmit={continueIdentity}
                className="space-y-5"
              >
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="staff-email" className="text-sm text-muted-foreground">
                    Email / User ID
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="staff-email"
                      type="email"
                      placeholder="you@patliputravinfast.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      className="pl-10 bg-secondary/50 border-border/50"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full font-semibold py-5">
                  Continue
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="password"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                onSubmit={handleLogin}
                className="space-y-5"
              >
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{email}</span>
                  <button
                    type="button"
                    className="text-xs text-primary inline-flex items-center gap-1 shrink-0"
                    onClick={() => {
                      setStep("identity");
                      setPassword("");
                      setError("");
                    }}
                  >
                    <ArrowLeft className="h-3 w-3" /> Change
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="staff-password" className="text-sm text-muted-foreground">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={openForgot}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      className="pl-10 pr-10 bg-secondary/50 border-border/50"
                      autoComplete="current-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-xs text-muted-foreground space-y-1">
            <span className="block">
              Admin access?{" "}
              <Link to="/admin/login" className="text-primary hover:underline">
                Login as admin
              </Link>
            </span>
            <span className="block">
              Customer booking access?{" "}
              <Link to="/customer/login" className="text-primary hover:underline">
                Login as customer
              </Link>
            </span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default StaffLogin;
