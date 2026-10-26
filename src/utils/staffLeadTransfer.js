const TDStaff = require('../models/TDStaff');
const ApiError = require('./apiError');

const TRANSFER_TARGETS = new Set(['unassigned', 'sales_manager', 'sales_head']);

function normalizeTransferTarget(raw) {
  const v = String(raw || 'unassigned')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (v === 'sm') return 'sales_manager';
  if (v === 'sh') return 'sales_head';
  return TRANSFER_TARGETS.has(v) ? v : 'unassigned';
}

/**
 * Resolve SM or SH in the reporting chain for a departing staff member.
 */
async function resolveLeadTransferAssignee(staff, transferTarget) {
  const mode = normalizeTransferTarget(transferTarget);
  if (mode === 'unassigned') return null;

  const wantDesignations =
    mode === 'sales_head'
      ? new Set(['sales_head', 'branch_manager', 'gm', 'ceo', 'md'])
      : new Set(['sales_manager', 'branch_manager', 'sales_head', 'gm', 'ceo', 'md']);

  let cur = staff;
  const seen = new Set([String(staff._id)]);

  while (cur?.reportsTo) {
    const parentId = String(cur.reportsTo?._id || cur.reportsTo);
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    const mgr = await TDStaff.findById(parentId).select('name email designation reportsTo active').lean();
    if (!mgr || mgr.active === false) break;
    if (mode === 'sales_manager' && ['sales_manager', 'branch_manager'].includes(mgr.designation)) {
      return mgr;
    }
    if (mode === 'sales_head' && mgr.designation === 'sales_head') {
      return mgr;
    }
    if (mode === 'sales_head' && ['gm', 'ceo', 'md'].includes(mgr.designation)) {
      return mgr;
    }
    cur = mgr;
  }

  if (mode === 'sales_manager' && staff.reportsTo) {
    const direct = await TDStaff.findById(staff.reportsTo).select('name email designation active').lean();
    if (direct?.active !== false && wantDesignations.has(direct.designation)) return direct;
  }

  throw new ApiError(
    400,
    mode === 'sales_head'
      ? 'No Sales Head found in this user’s reporting chain. Set Reports-to in User Master or choose Sales Manager / Unassigned.'
      : 'No Sales Manager found in this user’s reporting chain. Set Reports-to in User Master or choose Sales Head / Unassigned.',
  );
}

module.exports = {
  normalizeTransferTarget,
  resolveLeadTransferAssignee,
  TRANSFER_TARGETS,
};
