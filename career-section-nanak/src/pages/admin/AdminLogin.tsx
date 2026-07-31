import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, ArrowLeft, ShieldCheck } from "lucide-react";
import vinLogo from "@/assets/patliputra-vinfast-logo.png";
import { hasApi } from "@/lib/apiConfig";
import { adminLogin, ApiRequestError, formatApiErrors } from "@/lib/api";
import { markAdminSessionStart, setAdminSession, getAdminLoginRedirect, type AdminUser } from "@/lib/adminAuth";

/**
 * Admin portal login — Admin accounts only.
 * Isolated from Staff portal authentication.
 */
const AdminLogin = () => {
  const [step, setStep] = useState<"identity" | "password">("identity");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";

  const continueIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter your registered admin email to continue");
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
        const { token, admin } = await adminLogin(email.trim(), password);
        const user: AdminUser = {
          ...(admin as AdminUser),
          userType: "admin",
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
    navigate("/admin/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-border/60 bg-card/95 p-8 sm:p-10 shadow-sm backdrop-blur">
          <div className="text-center mb-8">
            <img
              src={vinLogo}
              alt="Patliputra VinFast"
              className="mx-auto mb-4 h-16 w-auto max-w-[min(100%,280px)] object-contain sm:h-20 sm:max-w-[320px]"
            />
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin portal
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Admin Login</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {step === "identity"
                ? "Step 1 of 2 — enter your registered admin email"
                : "Step 2 of 2 — enter your password"}
            </p>
          </div>

          {sessionExpired && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              Your session has expired (after 1 hour). Please sign in again to continue.
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === "identity" ? (
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
                  <Label htmlFor="email" className="text-sm text-muted-foreground">
                    Email / User ID
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@patliputravinfast.com"
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
                  <Label htmlFor="password" className="text-sm text-muted-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
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
              Employee / CRM access?{" "}
              <Link to="/staff/login" className="text-primary hover:underline">
                Login as employee
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

export default AdminLogin;
