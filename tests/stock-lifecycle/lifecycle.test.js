const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  compareConfig,
  canTransitionPo,
  canTransitionVehicle,
  computeAgeingBucket,
} = require('../../src/services/vehicleLifecycleService');

test('AC-02: config mismatch detected', () => {
  const result = compareConfig(
    { model: 'VF7', variant: 'Plus', colour: 'White' },
    { model: 'VF7', variant: 'Eco', colour: 'White' },
  );
  assert.equal(result, 'MISMATCH');
});

test('AC-02: config match', () => {
  const result = compareConfig(
    { model: 'VF7', variant: 'Plus', colour: 'White' },
    { model: 'VF7', variant: 'Plus', colour: 'White' },
  );
  assert.equal(result, 'MATCH');
});

test('AC-04/03: PDI pass transitions to AVAILABLE', () => {
  assert.equal(canTransitionVehicle('PDI_PENDING', 'PDI_PASS'), true);
  assert.equal(canTransitionVehicle('PDI_FAIL', 'AVAILABLE'), false);
});

test('AC-06/07: AVAILABLE to RESERVED allowed', () => {
  assert.equal(canTransitionVehicle('AVAILABLE', 'RESERVED'), true);
  assert.equal(canTransitionVehicle('RESERVED', 'AVAILABLE'), true);
});

test('AC-11: PO draft to submitted', () => {
  assert.equal(canTransitionPo('DRAFT', 'SUBMITTED'), true);
  assert.equal(canTransitionPo('DRAFT', 'RELEASED'), false);
});

test('ageing bucket 60+', () => {
  const old = new Date(Date.now() - 70 * 86400000);
  const bucket = computeAgeingBucket(old);
  assert.ok(bucket === '61-90' || bucket === '90+');
});
