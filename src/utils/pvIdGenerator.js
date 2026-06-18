const Counter = require('../models/Counter');

async function nextId(key, prefix) {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `${prefix}${String(doc.seq).padStart(3, '0')}`;
}

async function nextCustomerId() {
  return nextId('pv_customer', 'PVCUST');
}

async function nextLeadId() {
  return nextId('pv_lead', 'PVLEAD');
}

async function nextOpportunityId() {
  return nextId('pv_opportunity', 'PVOPP');
}

module.exports = {
  nextCustomerId,
  nextLeadId,
  nextOpportunityId,
};
