const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isCrmLeadTdBookedForCoordinator,
  crmTdBookedLeadsMongoFilter,
  CRM_TD_BOOKED_STATUSES,
} = require('../src/utils/tdCoordinatorAssignment');

test('CRM_TD_BOOKED_STATUSES includes Test Drive Booked', () => {
  assert.ok(CRM_TD_BOOKED_STATUSES.includes('Test Drive Booked'));
});

test('isCrmLeadTdBookedForCoordinator — status', () => {
  assert.equal(isCrmLeadTdBookedForCoordinator({ status: 'Test Drive Booked' }), true);
  assert.equal(isCrmLeadTdBookedForCoordinator({ status: 'Interested' }), false);
});

test('isCrmLeadTdBookedForCoordinator — tdBookingId', () => {
  assert.equal(isCrmLeadTdBookedForCoordinator({ status: 'Interested', tdBookingId: 'abc' }), true);
});

test('crmTdBookedLeadsMongoFilter shape', () => {
  const filter = crmTdBookedLeadsMongoFilter();
  assert.ok(Array.isArray(filter.$or));
  assert.ok(filter.$or.length >= 2);
});
