const Lead = require('../models/Lead');
const { isCreUser } = require('./leadAssignment');

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mobileMatchValues(mobiles) {
  const out = new Set();
  for (const raw of mobiles || []) {
    const s = String(raw || '').trim();
    if (!s) continue;
    out.add(s);
    const digits = s.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (last10.length === 10) {
      out.add(last10);
      out.add(`91${last10}`);
      out.add(`+91${last10}`);
      out.add(`0${last10}`);
    }
  }
  return [...out];
}

/**
 * DSE executives only see feedback tied to their name / email / email local-part
 * (salesConsultant) or mobiles of leads assigned to them. Managers, CRE,
 * superadmin, and portal admins see everything.
 */
async function applyExecutiveFeedbackScope(admin, query, { matchConsultant = true } = {}) {
  if (!admin) return;
  if (admin.userType === 'admin') return;
  if (['manager', 'superadmin'].includes(admin.role) || isCreUser(admin)) return;
  if (admin.role !== 'executive') return;

  const or = [];
  if (matchConsultant) {
    const name = String(admin.name || '').trim();
    const email = String(admin.email || '').trim();
    const localPart = email.includes('@') ? email.split('@')[0] : email;
    for (const needle of [name, email, localPart]) {
      if (!needle || needle.length < 2) continue;
      or.push({ salesConsultant: new RegExp(`^\\s*${escapeRegex(needle)}\\s*$`, 'i') });
    }
  }

  const assignedMobiles = await Lead.find({ assignedTo: admin._id }).distinct('mobile');
  const mobiles = mobileMatchValues(assignedMobiles);
  if (mobiles.length) {
    or.push({ mobile: { $in: mobiles } });
  }

  if (!or.length) {
    query._id = null;
    return;
  }
  query.$and = query.$and || [];
  query.$and.push({ $or: or });
}

module.exports = {
  applyExecutiveFeedbackScope,
  mobileMatchValues,
};
