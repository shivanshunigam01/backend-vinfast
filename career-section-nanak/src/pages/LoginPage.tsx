import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield, UserRound, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import vinLogo from "@/assets/patliputra-vinfast-logo.png";
import { getCustomerToken } from "@/lib/customerAuth";
import {
  getAdminUser,
  getAdminLoginRedirect,
  getPortalLoginPath,
  isAdminSession,
  isStaffUserType,
} from "@/lib/adminAuth";

export default function LoginPage() {
  const customerLoggedIn = Boolean(getCustomerToken());
  const portalLoggedIn = isAdminSession();
  const portalUser = getAdminUser();
  const staffLoggedIn = portalLoggedIn && isStaffUserType(portalUser);
  const adminLoggedIn = portalLoggedIn && !staffLoggedIn;
  const adminContinueHref = adminLoggedIn ? getAdminLoginRedirect(portalUser) : "/admin/login";
  const staffContinueHref = staffLoggedIn ? getAdminLoginRedirect(portalUser) : "/staff/login";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 px-4 pb-16 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-lg"
        >
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
            <div className="mb-8 text-center">
              <img
                src={vinLogo}
                alt="Patliputra VinFast"
                className="mx-auto mb-4 h-14 w-auto object-contain"
              />
              <h1 className="font-display text-2xl font-bold text-foreground">Login</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose your portal — Admin, Staff, or Customer.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                to={customerLoggedIn ? "/customer/bookings" : "/customer/login"}
                className="group flex items-start gap-4 rounded-xl border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-semibold text-foreground">
                      {customerLoggedIn ? "Continue as Customer" : "Login as Customer"}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    View and manage your test drive bookings with mobile WhatsApp OTP.
                  </span>
                </span>
              </Link>

              <Link
                to={staffContinueHref}
                className="group flex items-start gap-4 rounded-xl border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-semibold text-foreground">
                      {staffLoggedIn ? "Continue as Staff" : "Login as Staff"}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    CRM and Test Drive team access with staff email and password.
                  </span>
                </span>
              </Link>

              <Link
                to={adminContinueHref}
                className="group flex items-start gap-4 rounded-xl border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-semibold text-foreground">
                      {adminLoggedIn ? "Continue as Admin" : "Login as Admin"}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Management and system administration with admin email and password.
                  </span>
                </span>
              </Link>
            </div>

            {portalLoggedIn && (
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Signed in portal:{" "}
                <Link to={getPortalLoginPath(portalUser)} className="text-primary hover:underline">
                  {getPortalLoginPath(portalUser)}
                </Link>
              </p>
            )}
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
