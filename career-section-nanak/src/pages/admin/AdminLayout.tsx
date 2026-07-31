import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, FileText, Settings, LogOut, Menu, X,
  Tag, Bell, Home, Image,
  CalendarCheck, Gauge, BarChart3, Building2, ChevronDown as ChevDown, User,
  MessageSquare, Clock, BellOff, Warehouse, CarFront, PackageCheck, Shield
} from "lucide-react";
import vinLogo from "@/assets/patliputra-vinfast-logo.png";
import { hasApi } from "@/lib/apiConfig";
import { adminGet } from "@/lib/api";
import { dashboardStatsFromApi } from "@/lib/apiMappers";
import { getEnquiriesAdminInitial, getLeadsAdminInitial, getTestDrivesAdminInitial } from "@/lib/vfLocalStorage";
import { mockEnquiries, mockLeads, mockTestDrives } from "@/data/mockData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clearAdminSession,
  getAdminToken,
  getAdminUser,
  isAdminSessionTimedOut,
  canAccessFullAdmin,
  isFieldStaffUser,
  isStaffPortalPath,
  getRestrictedModules,
  isPathAllowed,
  getAdminLoginRedirect,
  getPortalLoginPath,
} from "@/lib/adminAuth";
import { MODULE_BY_PATH } from "@/lib/adminModules";
import {
  dismissNotification,
  dismissNotifications,
  isNotificationDismissed,
  notificationFingerprint,
} from "@/lib/adminNotifications";
import { toast } from "sonner";

const ADMIN_SESSION_EXPIRED_TOAST =
  "Your session has expired. Please sign in again — your access token is no longer valid after one hour.";

const coreNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Calendar",  icon: Clock,           path: "/admin/calendar" },
  { label: "Homepage",  icon: Home,            path: "/admin/homepage" },
  { label: "Lead CRM",  icon: Users,           path: "/admin/crm/leads" },
  { label: "Products",  icon: Car,             path: "/admin/products" },
  { label: "Offers",    icon: Tag,             path: "/admin/offers" },
  { label: "Content",   icon: FileText,        path: "/admin/content" },
  { label: "Media",     icon: Image,           path: "/admin/media" },
  { label: "Settings",  icon: Settings,        path: "/admin/settings" },
];

const crmNavItems = [
  { label: "My Dashboard", icon: LayoutDashboard, path: "/admin/my-dashboard", staff: true },
  { label: "Lead CRM", icon: Users, path: "/admin/crm/leads", staff: true },
];

// Customer feedback form submissions (QR pages)
const feedbackNavItems = [
  { label: "TD Feedback", icon: CarFront, path: "/admin/feedback/test-drive" },
  { label: "Delivery Feedback", icon: PackageCheck, path: "/admin/feedback/post-delivery" },
];

const tdNavItems = [
  { label: "My Test Drives", icon: User,         path: "/admin/td/my-bookings", staff: true },
  { label: "Lead Reports",    icon: BarChart3,    path: "/admin/td/leads/reports", staff: false },
  { label: "TD Bookings",    icon: CalendarCheck, path: "/admin/td/bookings",    staff: false },
  { label: "Reschedule History", icon: Clock, path: "/admin/td/reschedule-history", staff: false },
  { label: "Fleet Health",   icon: Gauge,         path: "/admin/td/fleet-health", staff: false },
  { label: "User Master",    icon: Users,         path: "/admin/td/users",       staff: false },
  { label: "Roles",          icon: Shield,        path: "/admin/td/roles",       staff: false },
  { label: "Demo Fleet",     icon: Gauge,         path: "/admin/td/vehicles",    staff: false },
  { label: "Model Master",   icon: Car,           path: "/admin/td/models",      staff: false },
  { label: "Vehicle Stock",  icon: Warehouse,     path: "/admin/stock",          staff: false },
  { label: "TD Reports",     icon: BarChart3,     path: "/admin/td/reports",     staff: false },
  { label: "Slot Config",    icon: Building2,     path: "/admin/td/config",      staff: false },
];

type HeaderNotification = {
  id: string;
  /** Unique per current metric so dismissing "3 new leads" doesn't hide "4 new leads". */
  fingerprint: string;
  title: string;
  sub: string;
  icon: React.ElementType;
  path: string;
};

const NOTIF_POLL_MS = 60_000;

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tdMenuOpen, setTdMenuOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/admin/td") ||
        window.location.pathname.startsWith("/admin/stock")),
  );
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRev, setNotifRev] = useState(0);

  const adminUser = getAdminUser();
  const fieldStaff = isFieldStaffUser(adminUser);

  useEffect(() => {
    if (
      location.pathname.startsWith("/admin/td") ||
      location.pathname.startsWith("/admin/stock")
    ) {
      setTdMenuOpen(true);
    }
  }, [location.pathname]);
  const fullAdmin = canAccessFullAdmin(adminUser);
  // Per-user module access configured in User Master (null = no restriction).
  const restrictedModules = getRestrictedModules(adminUser);
  const canSeePath = (path: string) => {
    if (!restrictedModules) return true;
    const key = MODULE_BY_PATH[path];
    return Boolean(key && restrictedModules.includes(key));
  };
  const notifEnabled = fullAdmin && canSeePath("/admin/dashboard");

  useEffect(() => {
    if (!notifEnabled) {
      setNotifications([]);
      return;
    }

    let cancelled = false;
    const load = async (showSpinner: boolean) => {
      if (showSpinner) setNotifLoading(true);
      try {
        let newLeadsToday = 0;
        let tdPending = 0;
        let openEnquiries = 0;
        let pendingFollowUps = 0;

        if (hasApi()) {
          const res = await adminGet<Record<string, unknown>>("/admin/dashboard/stats");
          const stats = dashboardStatsFromApi(res.data);
          newLeadsToday = stats.newLeadsToday;
          tdPending = (stats.testDrivesByStatus.Pending ?? 0) + (stats.testDrivesByStatus.Scheduled ?? 0);
          openEnquiries = stats.openEnquiries;
          pendingFollowUps = stats.pendingFollowUps;
        } else {
          const { seedMock: sl, leads } = getLeadsAdminInitial();
          const L = sl ? mockLeads : leads;
          const { seedMock: st, bookings } = getTestDrivesAdminInitial();
          const T = st ? mockTestDrives : bookings;
          const { seedMock: se, enquiries } = getEnquiriesAdminInitial();
          const E = se ? mockEnquiries : enquiries;
          const today = new Date().toISOString().slice(0, 10);
          newLeadsToday = L.filter((l) => (l.createdAt || "").slice(0, 10) === today).length;
          tdPending = T.filter((t) => t.status === "Pending" || t.status === "Scheduled").length;
          openEnquiries = E.filter((e) => e.status === "Open" || e.status === "In Progress").length;
          pendingFollowUps = L.filter((l) => l.nextFollowUp).length;
        }

        const todayKey = new Date().toISOString().slice(0, 10);
        const candidates: HeaderNotification[] = [];
        if (newLeadsToday > 0) {
          candidates.push({
            id: "leads-today",
            fingerprint: notificationFingerprint("leads-today", `${todayKey}:${newLeadsToday}`),
            title: `${newLeadsToday} new lead${newLeadsToday === 1 ? "" : "s"} today`,
            sub: "Review and assign the latest leads",
            icon: Users,
            path: "/admin/crm/leads",
          });
        }
        if (tdPending > 0) {
          candidates.push({
            id: "td-pending",
            fingerprint: notificationFingerprint("td-pending", tdPending),
            title: `${tdPending} test drive${tdPending === 1 ? "" : "s"} awaiting action`,
            sub: "Pending or scheduled bookings",
            icon: CalendarCheck,
            path: "/admin/td/bookings",
          });
        }
        if (openEnquiries > 0) {
          candidates.push({
            id: "open-enquiries",
            fingerprint: notificationFingerprint("open-enquiries", openEnquiries),
            title: `${openEnquiries} open enquir${openEnquiries === 1 ? "y" : "ies"}`,
            sub: "Customers waiting for a response",
            icon: MessageSquare,
            path: "/admin/enquiries",
          });
        }
        if (pendingFollowUps > 0) {
          candidates.push({
            id: "follow-ups",
            fingerprint: notificationFingerprint("follow-ups", pendingFollowUps),
            title: `${pendingFollowUps} follow-up${pendingFollowUps === 1 ? "" : "s"} scheduled`,
            sub: "Leads with a next follow-up date",
            icon: Clock,
            path: "/admin/crm/leads",
          });
        }

        // Drop anything the admin has already viewed/cleared for this fingerprint.
        const unread = candidates.filter((n) => !isNotificationDismissed(n.fingerprint));
        if (!cancelled) setNotifications(unread);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled && showSpinner) setNotifLoading(false);
      }
    };

    void load(true);
    // Keep the badge live without waiting for the user to reopen the panel.
    const pollId = window.setInterval(() => void load(false), NOTIF_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [notifEnabled, notifRev]);

  const dismissAndHide = (fingerprints: string[]) => {
    dismissNotifications(fingerprints);
    setNotifications((prev) => prev.filter((n) => !fingerprints.includes(n.fingerprint)));
  };

  const handleNotificationClick = (n: HeaderNotification) => {
    dismissNotification(n.fingerprint);
    setNotifications((prev) => prev.filter((item) => item.fingerprint !== n.fingerprint));
    setNotifOpen(false);
    navigate(n.path);
  };

  const handleClearAllNotifications = () => {
    dismissAndHide(notifications.map((n) => n.fingerprint));
    setNotifOpen(false);
  };

  useEffect(() => {
    const api = hasApi();
    const tokenOk = api ? Boolean(getAdminToken()) : localStorage.getItem("admin_logged_in") === "true";
    const loginPath = getPortalLoginPath(adminUser);
    if (!tokenOk) {
      navigate(loginPath);
      return;
    }
    if (isAdminSessionTimedOut()) {
      clearAdminSession();
      toast.warning(ADMIN_SESSION_EXPIRED_TOAST, { duration: 10_000 });
      navigate(`${loginPath}?reason=session-expired`);
      return;
    }
    if (fieldStaff && !isStaffPortalPath(location.pathname)) {
      navigate("/admin/my-dashboard", { replace: true });
      return;
    }
    // Users with per-module access (User Master) can only open granted modules.
    if (restrictedModules && !isPathAllowed(adminUser, location.pathname)) {
      navigate(getAdminLoginRedirect(adminUser), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, location.pathname, fieldStaff]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!isAdminSessionTimedOut()) return;
      const loginPath = getPortalLoginPath(getAdminUser());
      clearAdminSession();
      toast.warning(ADMIN_SESSION_EXPIRED_TOAST, { duration: 10_000 });
      navigate(`${loginPath}?reason=session-expired`);
    }, 60_000);
    return () => clearInterval(id);
  }, [navigate]);

  const handleLogout = () => {
    const loginPath = getPortalLoginPath(adminUser);
    clearAdminSession();
    navigate(loginPath);
  };

  const visibleTdItems = tdNavItems.filter((item) => (item.staff || fullAdmin) && canSeePath(item.path));
  const visibleFeedbackItems = feedbackNavItems.filter((item) => canSeePath(item.path));
  const visibleCoreItems = [
    // Restricted users granted the staff portal see My Dashboard alongside core modules.
    ...(restrictedModules && canSeePath("/admin/my-dashboard")
      ? [{ label: "My Dashboard", icon: LayoutDashboard, path: "/admin/my-dashboard" }]
      : []),
    ...coreNavItems.filter((item) => canSeePath(item.path)),
  ];

  const avatarLabel = adminUser?.name
    ? adminUser.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "PA";

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex overflow-x-hidden">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden touch-manipulation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar stays fixed to the viewport; Sign Out never follows page scrolling. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(18rem,calc(100vw-2.5rem))] sm:w-64 lg:w-64 xl:w-72 flex-col overflow-hidden border-r border-border bg-card shadow-xl transition-transform duration-300 ease-out lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-3.5 sm:py-3">
          <Link
            to="/admin/dashboard"
            className="flex min-w-0 flex-1 items-center"
            onClick={() => setSidebarOpen(false)}
          >
            <img
              src={vinLogo}
              alt="Patliputra VinFast"
              className="h-9 w-auto max-w-full object-contain object-left sm:h-10"
            />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden touch-manipulation"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain px-2 py-2 sm:px-2.5">
          {fieldStaff ? (
            <>
              {crmNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
              {visibleTdItems.filter((item) => item.staff).map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            </>
          ) : (
            <>
              {visibleCoreItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}

              {visibleFeedbackItems.length > 0 && (
                <div className="pt-0.5">
                  <div className="mx-1 my-1 border-t border-border/50" />
                  <p className="px-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Feedback
                  </p>
                  {visibleFeedbackItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {visibleTdItems.length > 0 && (
                <div className="pt-0.5">
                  <div className="mx-1 my-1 border-t border-border/50" />
                  <button
                    type="button"
                    onClick={() => setTdMenuOpen((o) => !o)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                      location.pathname.startsWith("/admin/td") || location.pathname.startsWith("/admin/stock")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    aria-expanded={tdMenuOpen}
                  >
                    <CalendarCheck className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate flex-1 text-left">TD Management</span>
                    <ChevDown
                      className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${tdMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {tdMenuOpen ? (
                    <div className="mt-0.5 space-y-px border-l border-border/40 ml-3 pl-1">
                      {visibleTdItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            }`}
                          >
                            <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-border px-2 py-2 sm:px-2.5">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive touch-manipulation"
          >
            <LogOut className="h-4 w-4 shrink-0 opacity-90" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64 xl:ml-72">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 sm:min-h-16 sm:gap-4 sm:px-4 sm:py-0 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1 lg:block" />
          <Popover
            open={notifOpen}
            onOpenChange={(open) => {
              setNotifOpen(open);
              if (open) setNotifRev((r) => r + 1);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="relative shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {notifications.length}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleClearAllNotifications}
                    className="text-xs font-medium text-primary hover:underline touch-manipulation"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifLoading && notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-muted-foreground">
                    <BellOff className="h-6 w-6 opacity-60" />
                    <p className="text-sm">You're all caught up</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.fingerprint}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/50 touch-manipulation"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <n.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{n.title}</span>
                        <span className="block text-xs text-muted-foreground">{n.sub}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary transition-colors hover:bg-primary/30 sm:h-10 sm:w-10 touch-manipulation"
                aria-label="Profile menu"
                title={adminUser ? `${adminUser.email}${adminUser.designationLabel ? ` · ${adminUser.designationLabel}` : ""}` : ""}
              >
                {avatarLabel}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold text-foreground">{adminUser?.name || "Admin"}</p>
                {adminUser?.email ? (
                  <p className="truncate text-xs font-normal text-muted-foreground">{adminUser.email}</p>
                ) : null}
                {adminUser?.designationLabel ? (
                  <p className="truncate text-xs font-normal text-muted-foreground">{adminUser.designationLabel}</p>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate(getAdminLoginRedirect(adminUser))}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </DropdownMenuItem>
              {fullAdmin && canSeePath("/admin/settings") && (
                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/admin/settings")}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
