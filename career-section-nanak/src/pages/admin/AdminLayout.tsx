import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, FileText, Settings, LogOut, Menu, X,
  Tag, Bell, Home, Image, Layers, Briefcase,
  CalendarCheck, Gauge, BarChart3, Building2, ChevronDown as ChevDown, User,
  MessageSquare, Clock, BellOff, Warehouse, CarFront, PackageCheck, Shield, Trash2, ClipboardList
} from "lucide-react";
import vinfastLogo from "@/assets/patliputra-vinfast-logo.png";
import patliputraOutlineLogo from "@/assets/black outline logo patliputra.png";
import { hasApi } from "@/lib/apiConfig";
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
  fetchStaffNotifications,
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
  type StaffInboxItem,
} from "@/lib/crmNotificationsApi";
import { toast } from "sonner";

const ADMIN_SESSION_EXPIRED_TOAST =
  "Your session has expired. Please sign in again — your access token is no longer valid after one hour.";

const coreNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Calendar",  icon: Clock,           path: "/admin/calendar" },
  { label: "Homepage",  icon: Home,            path: "/admin/homepage" },
  { label: "Lead CRM",  icon: Users,           path: "/admin/crm/leads" },
  { label: "Lead Stages", icon: Layers,        path: "/admin/crm/lead-stages" },
  { label: "Buyer Types", icon: Briefcase,     path: "/admin/crm/buyer-types" },
  { label: "Pricing",   icon: Tag,             path: "/admin/pricing" },
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
  { label: "TD Bookings",    icon: CalendarCheck, path: "/admin/td/bookings",    staff: false },
  { label: "Reschedule History", icon: Clock, path: "/admin/td/reschedule-history", staff: false },
  { label: "Delete History", icon: Trash2, path: "/admin/td/delete-history", staff: false },
  { label: "Fleet Health",   icon: Gauge,         path: "/admin/td/fleet-health", staff: false },
  { label: "Demo Fleet",     icon: Gauge,         path: "/admin/td/vehicles",    staff: false },
  { label: "Model Master",   icon: Car,           path: "/admin/td/models",      staff: false },
  { label: "Slot Config",    icon: Building2,     path: "/admin/td/config",      staff: false },
];

const userMasterNavItems = [
  { label: "User Master", icon: Users, path: "/admin/td/users", staff: false },
  { label: "Roles", icon: Shield, path: "/admin/td/roles", staff: false },
];

const stockNavItems = [
  { label: "Vehicle Stock", icon: Warehouse, path: "/admin/stock", staff: false },
  { label: "Purchase Orders", icon: ClipboardList, path: "/admin/stock/purchase-orders", staff: false },
  { label: "Vehicle Orders", icon: Car, path: "/admin/stock/orders", staff: false },
  { label: "Deliveries", icon: PackageCheck, path: "/admin/stock/deliveries", staff: false },
];

function isReportsPath(pathname: string) {
  return (
    pathname.startsWith("/admin/reports") ||
    pathname.startsWith("/admin/td/leads/reports") ||
    pathname.startsWith("/admin/td/reports") ||
    pathname === "/admin/my-dashboard"
  );
}

function isUserMasterPath(pathname: string) {
  return pathname.startsWith("/admin/td/users") || pathname.startsWith("/admin/td/roles");
}

function isStockPath(pathname: string) {
  return pathname.startsWith("/admin/stock");
}

function isTdManagementPath(pathname: string) {
  return pathname.startsWith("/admin/td") && !isReportsPath(pathname) && !isUserMasterPath(pathname);
}

const reportsNavItems = [
  { label: "Lead Reports", icon: BarChart3, path: "/admin/td/leads/reports", staff: false },
  { label: "TD Reports", icon: BarChart3, path: "/admin/td/reports", staff: false },
  { label: "Delivery Reports", icon: PackageCheck, path: "/admin/reports/deliveries", staff: false },
  { label: "My Dashboard (performance)", icon: LayoutDashboard, path: "/admin/my-dashboard", staff: true },
];

type HeaderNotification = {
  id: string;
  fingerprint: string;
  title: string;
  sub: string;
  icon: React.ElementType;
  path: string;
  priority?: string;
};

const NOTIF_POLL_MS = 60_000;

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tdMenuOpen, setTdMenuOpen] = useState(
    () => typeof window !== "undefined" && isTdManagementPath(window.location.pathname),
  );
  const [reportsMenuOpen, setReportsMenuOpen] = useState(
    () => typeof window !== "undefined" && isReportsPath(window.location.pathname),
  );
  const [userMasterMenuOpen, setUserMasterMenuOpen] = useState(
    () => typeof window !== "undefined" && isUserMasterPath(window.location.pathname),
  );
  const [stockMenuOpen, setStockMenuOpen] = useState(
    () => typeof window !== "undefined" && isStockPath(window.location.pathname),
  );
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRev, setNotifRev] = useState(0);

  const [adminUser, setAdminUser] = useState(() => getAdminUser());
  const fieldStaff = isFieldStaffUser(adminUser);

  useEffect(() => {
    const syncUser = () => setAdminUser(getAdminUser());
    window.addEventListener("vf-admin-user-updated", syncUser);
    return () => window.removeEventListener("vf-admin-user-updated", syncUser);
  }, []);

  useEffect(() => {
    if (isTdManagementPath(location.pathname)) setTdMenuOpen(true);
    if (isReportsPath(location.pathname)) setReportsMenuOpen(true);
    if (isUserMasterPath(location.pathname)) setUserMasterMenuOpen(true);
    if (isStockPath(location.pathname)) setStockMenuOpen(true);
  }, [location.pathname]);
  const fullAdmin = canAccessFullAdmin(adminUser);
  // Per-user module access configured in User Master (null = no restriction).
  const restrictedModules = getRestrictedModules(adminUser);
  const canSeePath = (path: string) => {
    if (!restrictedModules) return true;
    const key = MODULE_BY_PATH[path];
    return Boolean(key && restrictedModules.includes(key));
  };
  const notifEnabled = Boolean(adminUser);

  useEffect(() => {
    if (!notifEnabled) {
      setNotifications([]);
      return;
    }

    let cancelled = false;
    const load = async (showSpinner: boolean) => {
      if (showSpinner) setNotifLoading(true);
      try {
        if (!hasApi()) {
          if (!cancelled) setNotifications([]);
          return;
        }
        const { items } = await fetchStaffNotifications(true);
        const mapped: HeaderNotification[] = items.map((n: StaffInboxItem) => ({
          id: n._id,
          fingerprint: n._id,
          title: n.title,
          sub: [n.customerName, n.body].filter(Boolean).join(" · ") || new Date(n.createdAt).toLocaleString("en-IN"),
          icon: n.priority === "urgent" ? Clock : n.type?.startsWith("td_") ? CalendarCheck : Users,
          path: n.href || "/admin/crm/leads",
          priority: n.priority,
        }));
        if (!cancelled) setNotifications(mapped);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled && showSpinner) setNotifLoading(false);
      }
    };

    void load(true);
    const pollId = window.setInterval(() => void load(false), NOTIF_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [notifEnabled, notifRev]);

  const handleNotificationClick = (n: HeaderNotification) => {
    void markStaffNotificationRead(n.id).catch(() => undefined);
    setNotifications((prev) => prev.filter((item) => item.id !== n.id));
    setNotifOpen(false);
    navigate(n.path);
  };

  const handleClearAllNotifications = () => {
    void markAllStaffNotificationsRead().catch(() => undefined);
    setNotifications([]);
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

  const visibleTdItems = tdNavItems.filter(
    (item) => (item.staff || fullAdmin || Boolean(restrictedModules)) && canSeePath(item.path),
  );
  const visibleUserMasterItems = userMasterNavItems.filter(
    (item) => (item.staff || fullAdmin || Boolean(restrictedModules)) && canSeePath(item.path),
  );
  const visibleStockItems = stockNavItems.filter(
    (item) => (item.staff || fullAdmin || Boolean(restrictedModules)) && canSeePath(item.path),
  );
  const visibleReportsItems = reportsNavItems.filter(
    (item) => (item.staff || fullAdmin || Boolean(restrictedModules)) && canSeePath(item.path),
  );
  const visibleFeedbackItems = feedbackNavItems.filter((item) => canSeePath(item.path));
  const visibleCoreItems = [
    // Restricted users granted the staff portal see My Dashboard alongside core modules
    // when Reports group is not visible (e.g. only my_dashboard + CRM).
    ...(restrictedModules &&
    canSeePath("/admin/my-dashboard") &&
    !visibleReportsItems.some((i) => i.path === "/admin/my-dashboard")
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
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden sm:gap-2"
            onClick={() => setSidebarOpen(false)}
          >
            <img
              src={vinfastLogo}
              alt="Patliputra VinFast"
              className="h-8 w-auto max-w-[7.5rem] shrink object-contain object-left sm:h-9 sm:max-w-[9rem]"
            />
            <span className="h-5 w-px shrink-0 bg-border sm:h-6" aria-hidden />
            <img
              src={patliputraOutlineLogo}
              alt="Patliputra Group"
              className="h-5 w-auto max-w-[5.5rem] shrink-0 object-contain object-left sm:h-6 sm:max-w-[6.5rem]"
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

              {visibleReportsItems.length > 0 && (
                <div className="pt-0.5">
                  <div className="mx-1 my-1 border-t border-border/50" />
                  <button
                    type="button"
                    onClick={() => setReportsMenuOpen((o) => !o)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                      isReportsPath(location.pathname)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    aria-expanded={reportsMenuOpen}
                  >
                    <BarChart3 className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate flex-1 text-left">Reports</span>
                    <ChevDown
                      className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${reportsMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {reportsMenuOpen ? (
                    <div className="mt-0.5 space-y-px border-l border-border/40 ml-3 pl-1">
                      {visibleReportsItems.map((item) => {
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

              {visibleTdItems.length > 0 && (
                <div className="pt-0.5">
                  <div className="mx-1 my-1 border-t border-border/50" />
                  <button
                    type="button"
                    onClick={() => setTdMenuOpen((o) => !o)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                      isTdManagementPath(location.pathname)
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

              {visibleUserMasterItems.length > 0 && (
                <div className="pt-0.5">
                  <div className="mx-1 my-1 border-t border-border/50" />
                  <button
                    type="button"
                    onClick={() => setUserMasterMenuOpen((o) => !o)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                      isUserMasterPath(location.pathname)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    aria-expanded={userMasterMenuOpen}
                  >
                    <Users className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate flex-1 text-left">User Master</span>
                    <ChevDown
                      className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${userMasterMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {userMasterMenuOpen ? (
                    <div className="mt-0.5 space-y-px border-l border-border/40 ml-3 pl-1">
                      {visibleUserMasterItems.map((item) => {
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

              {visibleStockItems.length > 0 && (
                <div className="pt-0.5">
                  <div className="mx-1 my-1 border-t border-border/50" />
                  <button
                    type="button"
                    onClick={() => setStockMenuOpen((o) => !o)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors touch-manipulation ${
                      isStockPath(location.pathname)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    aria-expanded={stockMenuOpen}
                  >
                    <Warehouse className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate flex-1 text-left">Stock / Vehicle Management</span>
                    <ChevDown
                      className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${stockMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {stockMenuOpen ? (
                    <div className="mt-0.5 space-y-px border-l border-border/40 ml-3 pl-1">
                      {visibleStockItems.map((item) => {
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
          <Link
            to="/admin/dashboard"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden lg:hidden"
          >
            <img
              src={vinfastLogo}
              alt="Patliputra VinFast"
              className="h-8 w-auto max-w-[7rem] shrink object-contain object-left"
            />
            <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
            <img
              src={patliputraOutlineLogo}
              alt="Patliputra Group"
              className="h-5 w-auto max-w-[5.5rem] shrink-0 object-contain object-left"
            />
          </Link>
          <div className="hidden min-w-0 flex-1 lg:block" />
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
                      className={`flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/50 touch-manipulation ${
                        n.priority === "urgent"
                          ? "border-l-2 border-l-red-500"
                          : n.priority === "today"
                            ? "border-l-2 border-l-orange-500"
                            : n.priority === "done"
                              ? "border-l-2 border-l-emerald-500"
                              : "border-l-2 border-l-sky-500"
                      }`}
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
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/admin/account")}>
                <User className="mr-2 h-4 w-4" /> My Account
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
