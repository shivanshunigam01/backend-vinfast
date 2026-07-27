/**
 * Module + action permission helpers for TDStaff User Master ACL.
 *
 * Rules:
 * - Admin portal accounts (userType !== 'tdstaff') → full access.
 * - Empty allowedModules → no custom ACL (role defaults apply; all actions allowed).
 * - Non-empty allowedModules → user may only open those modules.
 * - Non-empty allowedActions → only those `module:action` tokens are allowed
 *   (scoped to modules the user may access). Empty allowedActions with a
 *   custom module list → all actions for those modules (legacy / full module grant).
 */
const ApiError = require('./apiError');
const {
  ADMIN_MODULE_KEYS,
  ADMIN_MODULE_ACTIONS,
  actionToken,
  isValidActionToken,
  parseActionToken,
} = require('../constants/adminModules');

function hasCustomModuleAcl(user) {
  return Array.isArray(user?.allowedModules) && user.allowedModules.length > 0;
}

function hasCustomActionAcl(user) {
  return Array.isArray(user?.allowedActions) && user.allowedActions.length > 0;
}

function canAccessModule(user, moduleKey) {
  if (!user) return false;
  if (user.userType && user.userType !== 'tdstaff') return true;
  if (!hasCustomModuleAcl(user)) return true;
  return user.allowedModules.includes(moduleKey);
}

/**
 * @param {object} user - req.admin-shaped user
 * @param {string} moduleKey
 * @param {string} action - e.g. 'view' | 'delete'
 */
function canPerformAction(user, moduleKey, action) {
  if (!user) return false;
  if (user.userType && user.userType !== 'tdstaff') return true;
  if (!ADMIN_MODULE_KEYS.includes(moduleKey)) return false;
  const allowedOnModule = ADMIN_MODULE_ACTIONS[moduleKey] || [];
  if (!allowedOnModule.includes(action)) return false;

  if (!canAccessModule(user, moduleKey)) return false;

  // No custom module ACL → unrestricted at action level (role middleware still applies).
  if (!hasCustomModuleAcl(user)) return true;

  // Custom modules but no action list → full access within granted modules.
  if (!hasCustomActionAcl(user)) return true;

  return user.allowedActions.includes(actionToken(moduleKey, action));
}

/** Keeps only recognised module keys (deduped). Undefined when not provided. */
function sanitizeModules(allowedModules) {
  if (allowedModules === undefined) return undefined;
  if (!Array.isArray(allowedModules)) {
    throw new ApiError(400, 'allowedModules must be an array of module keys');
  }
  return [...new Set(allowedModules.map((m) => String(m).trim()))].filter((m) =>
    ADMIN_MODULE_KEYS.includes(m),
  );
}

/**
 * Keeps only valid `module:action` tokens, optionally scoped to granted modules.
 * Undefined when not provided.
 */
function sanitizeActions(allowedActions, allowedModules) {
  if (allowedActions === undefined) return undefined;
  if (!Array.isArray(allowedActions)) {
    throw new ApiError(400, 'allowedActions must be an array of action tokens (module:action)');
  }

  const moduleSet =
    Array.isArray(allowedModules) && allowedModules.length
      ? new Set(allowedModules)
      : null;

  const cleaned = [];
  const seen = new Set();
  for (const raw of allowedActions) {
    const token = String(raw || '').trim();
    if (!token || seen.has(token)) continue;
    if (!isValidActionToken(token)) continue;
    const parsed = parseActionToken(token);
    if (moduleSet && !moduleSet.has(parsed.module)) continue;
    seen.add(token);
    cleaned.push(token);
  }
  return cleaned;
}

/**
 * Express middleware: require a specific module action.
 * Admins and unrestricted staff pass; restricted staff need the token.
 */
function requireModuleAction(moduleKey, action) {
  return (req, _res, next) => {
    const user = req.admin;
    if (!user) return next(new ApiError(401, 'Not authenticated'));
    if (!canPerformAction(user, moduleKey, action)) {
      return next(
        new ApiError(
          403,
          `You do not have permission to ${action} on ${moduleKey.replace(/_/g, ' ')}`,
        ),
      );
    }
    return next();
  };
}

/**
 * Mutation routes that historically used role authorize():
 * - Custom ACL users → must have the module action
 * - Everyone else → must have one of the listed roles (admin portal always passes)
 */
function requireModuleActionOrRoles(moduleKey, action, ...roles) {
  return (req, _res, next) => {
    const user = req.admin;
    if (!user) return next(new ApiError(401, 'Not authenticated'));

    if (hasCustomModuleAcl(user)) {
      if (canPerformAction(user, moduleKey, action)) return next();
      return next(
        new ApiError(
          403,
          `You do not have permission to ${action} on ${moduleKey.replace(/_/g, ' ')}`,
        ),
      );
    }

    if (user.userType && user.userType !== 'tdstaff') return next();
    if (roles.includes(user.role)) return next();
    return next(new ApiError(403, 'You are not allowed to perform this action'));
  };
}

/**
 * Accept any one of several module:action pairs (e.g. DL verify from My Bookings or TD Bookings).
 * Custom-ACL users need at least one matching token; unrestricted users pass.
 */
function requireAnyModuleAction(pairs) {
  const list = Array.isArray(pairs) ? pairs : [];
  return (req, _res, next) => {
    const user = req.admin;
    if (!user) return next(new ApiError(401, 'Not authenticated'));
    if (!hasCustomModuleAcl(user)) return next();
    for (const [moduleKey, action] of list) {
      if (canPerformAction(user, moduleKey, action)) return next();
    }
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  };
}

module.exports = {
  canAccessModule,
  canPerformAction,
  hasCustomModuleAcl,
  hasCustomActionAcl,
  sanitizeModules,
  sanitizeActions,
  requireModuleAction,
  requireModuleActionOrRoles,
  requireAnyModuleAction,
  actionToken,
};
