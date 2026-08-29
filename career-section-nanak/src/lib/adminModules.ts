/**
 * Admin-panel module catalog for per-user access control (User Master).
 * Keys / actions must stay in sync with the backend (src/constants/adminModules.js).
 *
 * Action tokens are stored as `moduleKey:action` (e.g. feedback_test_drive:delete).
 */

export type AdminModuleKey =
  | "dashboard"
  | "homepage"
  | "crm_leads"
  | "crm_lead_stages"
  | "crm_buyer_types"
  | "pricing"
  | "delivery_reports"
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
  | "stock_delivery"
  | "stock_po"
  | "stock_dispatch"
  | "stock_gate"
  | "stock_grn"
  | "stock_receipt"
  | "stock_pdi"
  | "stock_rectification"
  | "stock_inventory"
  | "stock_allocation"
  | "stock_reports"
  | "stock_config"
  | "td_reports"
  | "td_config"
  | "calendar"
  | "td_reschedule_history"
  | "td_fleet_health";

export type AdminModuleAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "assign"
  | "export"
  | "reschedule"
  | "cancel"
  | "complete"
  | "reschedule_approve"
  | "verify_dl"
  | "start_drive"
  | "view_password"
  | "tag_demo"
  | "approve"
  | "schedule_charge"
  | "log_maintenance"
  | "receive"
  | "allocate"
  | "pdi"
  | "deliver";

export type AdminModule = {
  key: AdminModuleKey;
  label: string;
  path: string;
  group:
    | "Core"
    | "Employee portal"
    | "Feedback"
    | "TD Management"
    | "Reports"
    | "User Master"
    | "Stock / Vehicle Management";
  actions: AdminModuleAction[];
};

export const ACTION_LABELS: Record<AdminModuleAction, string> = {
  view: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  assign: "Assign",
  export: "Export",
  reschedule: "Reschedule",
  cancel: "Cancel",
  complete: "Complete",
  reschedule_approve: "Approve reschedule",
  verify_dl: "Verify DL",
  start_drive: "Start drive",
  view_password: "View password",
  tag_demo: "Tag as demo",
  approve: "Approve",
  schedule_charge: "Schedule charge",
  log_maintenance: "Log maintenance",
  receive: "Receive stock",
  allocate: "Allocate VIN",
  pdi: "Perform PDI",
  deliver: "Deliver vehicle",
};

export const ADMIN_MODULES: AdminModule[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin/dashboard", group: "Core", actions: ["view"] },
  { key: "calendar", label: "Calendar", path: "/admin/calendar", group: "Core", actions: ["view", "update"] },
  { key: "homepage", label: "Homepage", path: "/admin/homepage", group: "Core", actions: ["view", "create", "update", "delete"] },
  { key: "crm_leads", label: "Lead CRM", path: "/admin/crm/leads", group: "Core", actions: ["view", "create", "update", "delete", "assign", "export"] },
  { key: "crm_lead_stages", label: "Lead Stages", path: "/admin/crm/lead-stages", group: "Core", actions: ["view", "create", "update", "delete"] },
  { key: "crm_buyer_types", label: "Buyer Types", path: "/admin/crm/buyer-types", group: "Core", actions: ["view", "create", "update", "delete"] },
  { key: "pricing", label: "Pricing", path: "/admin/pricing", group: "Core", actions: ["view", "update"] },
  { key: "products", label: "Products", path: "/admin/products", group: "Core", actions: ["view", "create", "update", "delete"] },
  { key: "offers", label: "Offers", path: "/admin/offers", group: "Core", actions: ["view", "create", "update", "delete"] },
  { key: "content", label: "Content", path: "/admin/content", group: "Core", actions: ["view", "create", "update", "delete"] },
  { key: "media", label: "Media", path: "/admin/media", group: "Core", actions: ["view", "create", "update", "delete"] },
  { key: "settings", label: "Settings", path: "/admin/settings", group: "Core", actions: ["view", "update"] },
  { key: "my_dashboard", label: "My Dashboard", path: "/admin/my-dashboard", group: "Employee portal", actions: ["view"] },
  { key: "td_my_bookings", label: "My Test Drives", path: "/admin/td/my-bookings", group: "Employee portal", actions: ["view", "update", "verify_dl", "start_drive", "reschedule", "cancel", "complete"] },
  { key: "feedback_test_drive", label: "TD Feedback Forms", path: "/admin/feedback/test-drive", group: "Feedback", actions: ["view", "delete"] },
  { key: "feedback_post_delivery", label: "Delivery Feedback Forms", path: "/admin/feedback/post-delivery", group: "Feedback", actions: ["view", "delete"] },
  { key: "td_lead_reports", label: "Lead Reports", path: "/admin/td/leads/reports", group: "Reports", actions: ["view", "export"] },
  { key: "td_reports", label: "TD Reports", path: "/admin/td/reports", group: "Reports", actions: ["view", "export"] },
  { key: "delivery_reports", label: "Delivery Reports", path: "/admin/reports/deliveries", group: "Reports", actions: ["view", "export"] },
  { key: "td_bookings", label: "TD Bookings", path: "/admin/td/bookings", group: "TD Management", actions: ["view", "create", "update", "assign", "reschedule_approve", "verify_dl", "start_drive", "cancel"] },
  { key: "td_reschedule_history", label: "Reschedule History", path: "/admin/td/reschedule-history", group: "TD Management", actions: ["view", "approve"] },
  { key: "td_fleet_health", label: "Fleet Charging & Health", path: "/admin/td/fleet-health", group: "TD Management", actions: ["view", "schedule_charge", "log_maintenance"] },
  { key: "td_users", label: "User Master", path: "/admin/td/users", group: "User Master", actions: ["view", "create", "update", "delete", "view_password"] },
  { key: "td_vehicles", label: "Demo Fleet", path: "/admin/td/vehicles", group: "TD Management", actions: ["view", "create", "update", "delete"] },
  { key: "td_models", label: "Model Master", path: "/admin/td/models", group: "TD Management", actions: ["view", "create", "update", "delete"] },
  { key: "vehicle_stock", label: "Vehicle Stock", path: "/admin/stock", group: "Stock / Vehicle Management", actions: ["view", "create", "update", "delete", "tag_demo"] },
  { key: "stock_delivery", label: "Vehicle Orders", path: "/admin/stock/orders", group: "Stock / Vehicle Management", actions: ["view", "create", "update", "delete", "receive", "allocate", "pdi", "deliver"] },
  { key: "stock_po", label: "Purchase Orders", path: "/admin/stock/purchase-orders", group: "Stock / Vehicle Management", actions: ["view", "create", "update", "delete", "approve"] },
  { key: "stock_dispatch", label: "Dispatch & Transit", path: "/admin/stock/dispatches", group: "Stock / Vehicle Management", actions: ["view", "create", "update"] },
  { key: "stock_gate", label: "Gate Entry", path: "/admin/stock/gate-entry", group: "Stock / Vehicle Management", actions: ["view", "create"] },
  { key: "stock_grn", label: "GRN", path: "/admin/stock/grn", group: "Stock / Vehicle Management", actions: ["view", "create", "update"] },
  { key: "stock_receipt", label: "Receipt Verification", path: "/admin/stock/receipt", group: "Stock / Vehicle Management", actions: ["view", "create", "update"] },
  { key: "stock_pdi", label: "Pre-Stock PDI", path: "/admin/stock/pre-stock-pdi", group: "Stock / Vehicle Management", actions: ["view", "create", "update", "approve"] },
  { key: "stock_rectification", label: "Rectifications", path: "/admin/stock/rectifications", group: "Stock / Vehicle Management", actions: ["view", "create", "update"] },
  { key: "stock_inventory", label: "Stock Dashboard", path: "/admin/stock/dashboard", group: "Stock / Vehicle Management", actions: ["view", "update", "export"] },
  { key: "stock_allocation", label: "Deliveries", path: "/admin/stock/deliveries", group: "Stock / Vehicle Management", actions: ["view", "create", "update", "allocate"] },
  { key: "stock_config", label: "Stock Config", path: "/admin/stock/config", group: "Stock / Vehicle Management", actions: ["view", "update"] },
  { key: "td_config", label: "Slot Config", path: "/admin/td/config", group: "TD Management", actions: ["view", "update"] },
];

export const MODULE_BY_PATH: Record<string, AdminModuleKey> = Object.fromEntries(
  ADMIN_MODULES.map((m) => [m.path, m.key]),
) as Record<string, AdminModuleKey>;

/** Roles UI shares User Master ACL (td_users). */
MODULE_BY_PATH["/admin/td/roles"] = "td_users";
/** Delete audit trail shares TD Bookings ACL (td_bookings). */
MODULE_BY_PATH["/admin/td/delete-history"] = "td_bookings";
MODULE_BY_PATH["/admin/stock/purchase-orders"] = "stock_po";
MODULE_BY_PATH["/admin/stock/orders"] = "stock_delivery";
MODULE_BY_PATH["/admin/stock/deliveries"] = "stock_allocation";
MODULE_BY_PATH["/admin/stock/dashboard"] = "stock_inventory";
MODULE_BY_PATH["/admin/stock/dispatches"] = "stock_dispatch";
MODULE_BY_PATH["/admin/stock/gate-entry"] = "stock_gate";
MODULE_BY_PATH["/admin/stock/grn"] = "stock_grn";
MODULE_BY_PATH["/admin/stock/receipt"] = "stock_receipt";
MODULE_BY_PATH["/admin/stock/pre-stock-pdi"] = "stock_pdi";
MODULE_BY_PATH["/admin/stock/rectifications"] = "stock_rectification";
MODULE_BY_PATH["/admin/stock/config"] = "stock_config";

export const MODULE_GROUPS = [
  "Core",
  "Employee portal",
  "Feedback",
  "Reports",
  "TD Management",
  "User Master",
  "Stock / Vehicle Management",
] as const;

export function modulesForGroup(group: AdminModule["group"]) {
  return ADMIN_MODULES.filter((m) => m.group === group);
}

export function moduleByKey(key: AdminModuleKey): AdminModule | undefined {
  return ADMIN_MODULES.find((m) => m.key === key);
}

export function actionToken(moduleKey: AdminModuleKey, action: AdminModuleAction): string {
  return `${moduleKey}:${action}`;
}

export function parseActionToken(token: string): { module: AdminModuleKey; action: AdminModuleAction } | null {
  const i = token.indexOf(":");
  if (i <= 0) return null;
  return {
    module: token.slice(0, i) as AdminModuleKey,
    action: token.slice(i + 1) as AdminModuleAction,
  };
}

/** All action tokens for the given modules (used when enabling a module). */
export function allActionTokensForModules(moduleKeys: AdminModuleKey[]): string[] {
  const out: string[] = [];
  for (const key of moduleKeys) {
    const mod = moduleByKey(key);
    if (!mod) continue;
    for (const action of mod.actions) out.push(actionToken(key, action));
  }
  return out;
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
  "crm_lead_stages",
  "crm_buyer_types",
  "my_dashboard",
  "td_my_bookings",
  "td_bookings",
  "td_reschedule_history",
  "td_fleet_health",
  "td_lead_reports",
  "td_reports",
  "delivery_reports",
];
