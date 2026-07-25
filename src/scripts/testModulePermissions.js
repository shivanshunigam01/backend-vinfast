/**
 * Lightweight node tests for module + action ACL helpers (no Jest required).
 * Run: node src/scripts/testModulePermissions.js
 */
const assert = require('assert');
const {
  ADMIN_MODULE_KEYS,
  ADMIN_MODULE_ACTIONS,
  actionToken,
  isValidActionToken,
} = require('../constants/adminModules');
const {
  canPerformAction,
  canAccessModule,
  sanitizeModules,
  sanitizeActions,
  hasCustomModuleAcl,
} = require('../utils/modulePermissions');

function staff(partial = {}) {
  return {
    name: 'Test',
    email: 't@example.com',
    role: 'executive',
    userType: 'tdstaff',
    allowedModules: [],
    allowedActions: [],
    ...partial,
  };
}

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\nModule permission tests\n');

check('every module has a view action', () => {
  for (const key of ADMIN_MODULE_KEYS) {
    assert.ok(ADMIN_MODULE_ACTIONS[key], `missing actions for ${key}`);
    assert.strictEqual(ADMIN_MODULE_ACTIONS[key][0], 'view');
  }
});

check('action tokens validate', () => {
  assert.strictEqual(isValidActionToken('feedback_test_drive:delete'), true);
  assert.strictEqual(isValidActionToken('feedback_test_drive:explode'), false);
  assert.strictEqual(isValidActionToken('nope'), false);
});

check('sanitizeModules filters unknowns', () => {
  const cleaned = sanitizeModules(['crm_leads', 'nope', 'crm_leads']);
  assert.deepStrictEqual(cleaned, ['crm_leads']);
});

check('sanitizeActions scopes to modules and drops junk', () => {
  const cleaned = sanitizeActions(
    [
      'feedback_test_drive:view',
      'feedback_test_drive:delete',
      'crm_leads:view',
      'feedback_test_drive:hack',
      'bad',
    ],
    ['feedback_test_drive'],
  );
  assert.deepStrictEqual(cleaned, [
    'feedback_test_drive:view',
    'feedback_test_drive:delete',
  ]);
});

check('admin portal always allowed', () => {
  const user = staff({ userType: 'admin', role: 'superadmin' });
  assert.strictEqual(canPerformAction(user, 'feedback_test_drive', 'delete'), true);
});

check('unrestricted staff pass action check', () => {
  const user = staff();
  assert.strictEqual(hasCustomModuleAcl(user), false);
  assert.strictEqual(canPerformAction(user, 'feedback_test_drive', 'delete'), true);
});

check('custom ACL view-only cannot delete', () => {
  const user = staff({
    allowedModules: ['feedback_test_drive'],
    allowedActions: ['feedback_test_drive:view'],
  });
  assert.strictEqual(canAccessModule(user, 'feedback_test_drive'), true);
  assert.strictEqual(canPerformAction(user, 'feedback_test_drive', 'view'), true);
  assert.strictEqual(canPerformAction(user, 'feedback_test_drive', 'delete'), false);
});

check('custom ACL with delete can delete', () => {
  const user = staff({
    role: 'executive',
    allowedModules: ['feedback_test_drive'],
    allowedActions: [
      actionToken('feedback_test_drive', 'view'),
      actionToken('feedback_test_drive', 'delete'),
    ],
  });
  assert.strictEqual(canPerformAction(user, 'feedback_test_drive', 'delete'), true);
});

check('empty actions on custom modules = all actions', () => {
  const user = staff({
    allowedModules: ['vehicle_stock'],
    allowedActions: [],
  });
  assert.strictEqual(canPerformAction(user, 'vehicle_stock', 'tag_demo'), true);
  assert.strictEqual(canPerformAction(user, 'crm_leads', 'view'), false);
});

if (process.exitCode) {
  console.log(`\nFAILED — ${passed} checks passed before failure\n`);
} else {
  console.log(`\nAll ${passed} checks passed.\n`);
}
