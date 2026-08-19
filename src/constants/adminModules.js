/**
 * Admin-panel module keys + per-module actions for User Master RBAC.
 * Must stay in sync with career-section-nanak/src/lib/adminModules.ts.
 *
 * Action tokens are stored as `moduleKey:action` (e.g. feedback_test_drive:delete).
 */
const ADMIN_MODULE_KEYS = [
  // Core
  'dashboard',
  'homepage',
  'crm_leads',
  'crm_lead_stages',
  'crm_buyer_types',
  'pricing',
  'delivery_reports',
  'products',
  'offers',
  'content',
  'media',
  'settings',
  // Employee portal
  'my_dashboard',
  'td_my_bookings',
  // Customer feedback
  'feedback_test_drive',
  'feedback_post_delivery',
  // TD Management
  'td_lead_reports',
  'td_bookings',
  'td_users',
  'td_vehicles',
  'td_models',
  'vehicle_stock',
  'stock_delivery',
  'td_reports',
  'td_config',
  'calendar',
  'td_reschedule_history',
  'td_fleet_health',
];

/** Actions available on each module. `view` is always first (required to open the module). */
const ADMIN_MODULE_ACTIONS = {
  dashboard: ['view'],
  homepage: ['view', 'create', 'update', 'delete'],
  crm_leads: ['view', 'create', 'update', 'delete', 'assign', 'export'],
  crm_lead_stages: ['view', 'create', 'update', 'delete'],
  crm_buyer_types: ['view', 'create', 'update', 'delete'],
  pricing: ['view', 'update'],
  delivery_reports: ['view', 'export'],
  products: ['view', 'create', 'update', 'delete'],
  offers: ['view', 'create', 'update', 'delete'],
  content: ['view', 'create', 'update', 'delete'],
  media: ['view', 'create', 'update', 'delete'],
  settings: ['view', 'update'],
  my_dashboard: ['view'],
  td_my_bookings: ['view', 'update', 'verify_dl', 'start_drive', 'reschedule', 'cancel', 'complete'],
  feedback_test_drive: ['view', 'delete'],
  feedback_post_delivery: ['view', 'delete'],
  td_lead_reports: ['view', 'export'],
  td_bookings: ['view', 'create', 'update', 'assign', 'reschedule_approve', 'verify_dl', 'start_drive', 'cancel'],
  td_users: ['view', 'create', 'update', 'delete', 'view_password'],
  td_vehicles: ['view', 'create', 'update', 'delete'],
  td_models: ['view', 'create', 'update', 'delete'],
  vehicle_stock: ['view', 'create', 'update', 'delete', 'tag_demo'],
  stock_delivery: ['view', 'create', 'update', 'delete', 'receive', 'allocate', 'pdi', 'deliver'],
  td_reports: ['view', 'export'],
  td_config: ['view', 'update'],
  calendar: ['view', 'update'],
  td_reschedule_history: ['view', 'approve'],
  td_fleet_health: ['view', 'schedule_charge', 'log_maintenance'],
};

const ACTION_LABELS = {
  view: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  assign: 'Assign',
  export: 'Export',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
  complete: 'Complete',
  reschedule_approve: 'Approve reschedule',
  verify_dl: 'Verify DL',
  start_drive: 'Start drive',
  view_password: 'View password',
  tag_demo: 'Tag as demo',
  approve: 'Approve',
  schedule_charge: 'Schedule charge',
  log_maintenance: 'Log maintenance',
  receive: 'Receive stock',
  allocate: 'Allocate VIN',
  pdi: 'Perform PDI',
  deliver: 'Deliver vehicle',
};

function actionToken(moduleKey, action) {
  return `${moduleKey}:${action}`;
}

function parseActionToken(token) {
  const raw = String(token || '');
  const i = raw.indexOf(':');
  if (i <= 0) return null;
  return { module: raw.slice(0, i), action: raw.slice(i + 1) };
}

function isValidActionToken(token) {
  const parsed = parseActionToken(token);
  if (!parsed) return false;
  const actions = ADMIN_MODULE_ACTIONS[parsed.module];
  return Boolean(actions && actions.includes(parsed.action));
}

/** All valid action tokens across the catalog. */
function allActionTokensForModules(moduleKeys) {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [];
  const out = [];
  for (const key of keys) {
    for (const action of ADMIN_MODULE_ACTIONS[key] || []) {
      out.push(actionToken(key, action));
    }
  }
  return out;
}

module.exports = {
  ADMIN_MODULE_KEYS,
  ADMIN_MODULE_ACTIONS,
  ACTION_LABELS,
  actionToken,
  parseActionToken,
  isValidActionToken,
  allActionTokensForModules,
};
