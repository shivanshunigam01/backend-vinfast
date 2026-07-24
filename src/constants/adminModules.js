/**
 * Admin-panel module keys used for per-user access control (User Master).
 * Must stay in sync with the frontend sidebar (career-section-nanak
 * src/lib/adminModules.ts).
 */
const ADMIN_MODULE_KEYS = [
  // Core modules
  'dashboard',
  'homepage',
  'crm_leads',
  'products',
  'offers',
  'content',
  'media',
  'settings',
  // Staff portal
  'my_dashboard',
  'td_my_bookings',
  // Customer feedback forms
  'feedback_test_drive',
  'feedback_post_delivery',
  // TD Management
  'td_lead_reports',
  'td_bookings',
  'td_users',
  'td_vehicles',
  'td_models',
  'vehicle_stock',
  'td_reports',
  'td_config',
  // MoM enhancements
  'calendar',
  'td_reschedule_history',
  'td_fleet_health',
];

/** Optional action-level permissions nested under modules (granular RBAC). */
const ADMIN_MODULE_ACTIONS = {
  td_bookings: ['view', 'assign', 'reschedule_approve', 'verify_dl', 'start_drive', 'cancel'],
  crm_leads: ['view', 'create', 'update', 'assign', 'export'],
  td_users: ['view', 'create', 'update', 'view_password'],
  td_fleet_health: ['view', 'schedule_charge', 'log_maintenance'],
  calendar: ['view'],
  td_reschedule_history: ['view', 'approve'],
};

module.exports = { ADMIN_MODULE_KEYS, ADMIN_MODULE_ACTIONS };
