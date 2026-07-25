/**
 * Admin-panel module catalog for per-user access control (User Master).
 * Keys must stay in sync with the backend (src/constants/adminModules.js).
 */

export type AdminModuleKey =
  | "dashboard"
  | "homepage"
  | "crm_leads"
  | "products"
  | "offers"
  | "content"
  | "media"
  | "settings"
  | "my_dashboard"
  | "td_my_bookings"
  | "feedback_test_drive"
  | "feedback_post_delivery"
  | "td_lead_reports"
  | "td_bookings"
  | "td_users"
  | "td_vehicles"
  | "td_models"
  | "vehicle_stock"
  | "td_reports"
  | "td_config"
  | "calendar"
  | "td_reschedule_history"
  | "td_fleet_health";

export type AdminModule = {
  key: AdminModuleKey;
  label: string;
  path: string;
  group: "Core" | "Staff portal" | "Feedback" | "TD Management";
};

export const ADMIN_MODULES: AdminModule[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin/dashboard", group: "Core" },
  { key: "calendar", label: "Calendar", path: "/admin/calendar", group: "Core" },
  { key: "homepage", label: "Homepage", path: "/admin/homepage", group: "Core" },
  { key: "crm_leads", label: "Lead CRM", path: "/admin/crm/leads", group: "Core" },
  { key: "products", label: "Products", path: "/admin/products", group: "Core" },
  { key: "offers", label: "Offers", path: "/admin/offers", group: "Core" },
  { key: "content", label: "Content", path: "/admin/content", group: "Core" },
  { key: "media", label: "Media", path: "/admin/media", group: "Core" },
  { key: "settings", label: "Settings", path: "/admin/settings", group: "Core" },
  { key: "my_dashboard", label: "My Dashboard", path: "/admin/my-dashboard", group: "Staff portal" },
  { key: "td_my_bookings", label: "My Test Drives", path: "/admin/td/my-bookings", group: "Staff portal" },
  { key: "feedback_test_drive", label: "TD Feedback Forms", path: "/admin/feedback/test-drive", group: "Feedback" },
  { key: "feedback_post_delivery", label: "Delivery Feedback Forms", path: "/admin/feedback/post-delivery", group: "Feedback" },
  { key: "td_lead_reports", label: "Lead Reports", path: "/admin/td/leads/reports", group: "TD Management" },
  { key: "td_bookings", label: "TD Bookings", path: "/admin/td/bookings", group: "TD Management" },
  { key: "td_reschedule_history", label: "Reschedule History", path: "/admin/td/reschedule-history", group: "TD Management" },
  { key: "td_fleet_health", label: "Fleet Charging & Health", path: "/admin/td/fleet-health", group: "TD Management" },
  { key: "td_users", label: "User Master", path: "/admin/td/users", group: "TD Management" },
  { key: "td_vehicles", label: "Demo Fleet", path: "/admin/td/vehicles", group: "TD Management" },
  { key: "td_models", label: "Model Master", path: "/admin/td/models", group: "TD Management" },
  { key: "vehicle_stock", label: "Vehicle Stock", path: "/admin/stock", group: "TD Management" },
  { key: "td_reports", label: "TD Reports", path: "/admin/td/reports", group: "TD Management" },
  { key: "td_config", label: "Slot Config", path: "/admin/td/config", group: "TD Management" },
];

export const MODULE_BY_PATH: Record<string, AdminModuleKey> = Object.fromEntries(
  ADMIN_MODULES.map((m) => [m.path, m.key]),
) as Record<string, AdminModuleKey>;

export const MODULE_GROUPS = ["Core", "Staff portal", "Feedback", "TD Management"] as const;

export function modulesForGroup(group: AdminModule["group"]) {
  return ADMIN_MODULES.filter((m) => m.group === group);
}

/** Default module sets per role, used when a user has no explicit allowedModules. */
export const EXECUTIVE_DEFAULT_MODULES: AdminModuleKey[] = [
  "my_dashboard",
  "td_my_bookings",
  "crm_leads",
  "calendar",
];

export const MANAGER_DEFAULT_MODULES: AdminModuleKey[] = [
  "dashboard",
  "calendar",
  "crm_leads",
  "my_dashboard",
  "td_my_bookings",
  "td_bookings",
  "td_reschedule_history",
  "td_fleet_health",
  "td_lead_reports",
  "td_reports",
];
