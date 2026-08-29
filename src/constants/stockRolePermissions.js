/**
 * Stock pipeline role → module/action mapping (Sheet 11_ROLE_PERMISSION).
 * Tokens must match src/constants/adminModules.js.
 */
const { allActionTokensForModules } = require('./adminModules');

function tokens(modules, actionsByModule = null) {
  if (!actionsByModule) {
    return allActionTokensForModules(modules);
  }
  const out = [];
  for (const mod of modules) {
    const actions = actionsByModule[mod] || ['view'];
    for (const action of actions) {
      out.push(`${mod}:${action}`);
    }
  }
  return out;
}

/** Named permission templates for User Master → Roles. */
const STOCK_ROLE_TEMPLATES = [
  {
    name: 'Stock Super Admin',
    description: 'Full access to all stock / PO / GRN / PDI modules',
    authRole: 'manager',
    allowedModules: [
      'stock_inventory', 'stock_po', 'stock_dispatch', 'stock_gate', 'stock_grn',
      'stock_receipt', 'stock_pdi', 'stock_rectification', 'vehicle_stock',
      'stock_delivery', 'stock_allocation', 'stock_reports', 'stock_config',
    ],
  },
  {
    name: 'GM / Dealer Head',
    description: 'Approve PO, PDI overrides, holds; view all stock areas',
    authRole: 'manager',
    allowedModules: [
      'stock_inventory', 'stock_po', 'stock_dispatch', 'stock_gate', 'stock_grn',
      'stock_receipt', 'stock_pdi', 'stock_rectification', 'vehicle_stock',
      'stock_delivery', 'stock_allocation', 'stock_reports',
    ],
    allowedActions: tokens(
      ['stock_inventory', 'stock_po', 'stock_dispatch', 'stock_gate', 'stock_grn', 'stock_receipt', 'stock_pdi', 'stock_rectification', 'vehicle_stock', 'stock_delivery', 'stock_allocation', 'stock_reports'],
      {
        stock_po: ['view', 'approve'],
        stock_pdi: ['view', 'approve'],
        stock_rectification: ['view', 'update'],
        stock_inventory: ['view', 'update', 'export'],
        stock_allocation: ['view', 'allocate'],
        stock_delivery: ['view', 'allocate', 'deliver'],
      },
    ),
  },
  {
    name: 'Stock / Procurement',
    description: 'Create & submit PO, dispatch, GRN, receipt (approval by GM / leadership)',
    authRole: 'manager',
    allowedModules: [
      'stock_inventory', 'stock_po', 'stock_dispatch', 'stock_gate', 'stock_grn',
      'stock_receipt', 'vehicle_stock', 'stock_reports',
    ],
    allowedActions: tokens(
      ['stock_inventory', 'stock_po', 'stock_dispatch', 'stock_gate', 'stock_grn', 'stock_receipt', 'vehicle_stock', 'stock_reports'],
      {
        stock_po: ['view', 'create', 'update'],
        stock_dispatch: ['view', 'create', 'update'],
        stock_gate: ['view', 'create'],
        stock_grn: ['view', 'create', 'update'],
        stock_receipt: ['view', 'create', 'update'],
        vehicle_stock: ['view', 'create', 'update', 'tag_demo'],
        stock_inventory: ['view', 'update', 'export'],
        stock_reports: ['view', 'export'],
      },
    ),
  },
  {
    name: 'Accounts',
    description: 'PO commercial fields, invoice view, delivery reports',
    authRole: 'manager',
    allowedModules: ['stock_po', 'stock_grn', 'stock_delivery', 'stock_reports', 'delivery_reports'],
    allowedActions: tokens(
      ['stock_po', 'stock_grn', 'stock_delivery', 'stock_reports', 'delivery_reports'],
      {
        stock_po: ['view', 'update'],
        stock_grn: ['view'],
        stock_delivery: ['view'],
        stock_reports: ['view', 'export'],
        delivery_reports: ['view', 'export'],
      },
    ),
  },
  {
    name: 'PDI Executive',
    description: 'Pre-stock and final PDI; create rectification issues',
    authRole: 'executive',
    allowedModules: ['stock_pdi', 'stock_rectification', 'vehicle_stock', 'stock_inventory'],
    allowedActions: tokens(
      ['stock_pdi', 'stock_rectification', 'vehicle_stock', 'stock_inventory'],
      {
        stock_pdi: ['view', 'create', 'update'],
        stock_rectification: ['view', 'create', 'update'],
        vehicle_stock: ['view'],
        stock_inventory: ['view'],
      },
    ),
  },
  {
    name: 'Service / Technician',
    description: 'Rectification workflow',
    authRole: 'executive',
    allowedModules: ['stock_rectification', 'stock_pdi', 'vehicle_stock'],
    allowedActions: tokens(
      ['stock_rectification', 'stock_pdi', 'vehicle_stock'],
      {
        stock_rectification: ['view', 'create', 'update'],
        stock_pdi: ['view'],
        vehicle_stock: ['view'],
      },
    ),
  },
  {
    name: 'Sales Manager',
    description: 'VIN allocation, delivery, and PO approval (Sales Head)',
    authRole: 'manager',
    allowedModules: ['stock_allocation', 'stock_delivery', 'stock_po', 'vehicle_stock', 'stock_inventory', 'stock_final_pdi', 'stock_retail', 'crm_leads'],
    allowedActions: tokens(
      ['stock_allocation', 'stock_delivery', 'stock_po', 'vehicle_stock', 'stock_inventory', 'crm_leads'],
      {
        stock_allocation: ['view', 'allocate', 'update', 'deliver'],
        stock_delivery: ['view', 'create', 'update', 'allocate', 'pdi', 'deliver'],
        stock_po: ['view', 'approve'],
        stock_final_pdi: ['view', 'pdi'],
        stock_retail: ['view', 'deliver'],
        vehicle_stock: ['view'],
        stock_inventory: ['view'],
        crm_leads: ['view', 'update', 'assign'],
      },
    ),
  },
  {
    name: 'Sales Executive',
    description: 'View stock; request allocation via orders',
    authRole: 'executive',
    allowedModules: ['stock_delivery', 'vehicle_stock', 'crm_leads', 'my_dashboard'],
    allowedActions: tokens(
      ['stock_delivery', 'vehicle_stock', 'crm_leads', 'my_dashboard'],
      {
        stock_delivery: ['view', 'create'],
        vehicle_stock: ['view'],
        crm_leads: ['view', 'update'],
        my_dashboard: ['view'],
      },
    ),
  },
  {
    name: 'Security',
    description: 'Gate entry only',
    authRole: 'executive',
    allowedModules: ['stock_gate'],
    allowedActions: tokens(['stock_gate'], { stock_gate: ['view', 'create'] }),
  },
];

for (const role of STOCK_ROLE_TEMPLATES) {
  if (!role.allowedActions?.length) {
    role.allowedActions = allActionTokensForModules(role.allowedModules);
  }
}

/** Default staff users — one per operational role (excluding Super Admin; use admin login). */
const STOCK_USER_SEED = [
  { name: 'Stock Manager', email: 'stock.manager@patliputravinfast.com', roleName: 'Stock / Procurement', designation: 'stock_manager', mobile: '9876543210' },
  { name: 'Procurement Lead', email: 'procurement@patliputravinfast.com', roleName: 'Stock / Procurement', designation: 'procurement', mobile: '9876543211' },
  { name: 'Accounts Stock', email: 'accounts.stock@patliputravinfast.com', roleName: 'Accounts', designation: 'accounts', mobile: '9876543212' },
  { name: 'PDI Executive', email: 'pdi@patliputravinfast.com', roleName: 'PDI Executive', designation: 'pdi_executive', mobile: '9876543213' },
  { name: 'Service Technician', email: 'service.stock@patliputravinfast.com', roleName: 'Service / Technician', designation: 'service_technician', mobile: '9876543214' },
  { name: 'Security Gate', email: 'security.gate@patliputravinfast.com', roleName: 'Security', designation: 'security', mobile: '9876543215' },
];

module.exports = { STOCK_ROLE_TEMPLATES, STOCK_USER_SEED };
