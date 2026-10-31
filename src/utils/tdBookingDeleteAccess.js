/** Permanent TD booking delete — portal Admin login and Superadmin only (not SM/managers). */
function canAdminPortalDeleteTdBooking(admin) {
  if (!admin) return false;
  if (admin.userType === 'admin') return true;
  if (String(admin.role || '').trim().toLowerCase() === 'superadmin') return true;
  return false;
}

module.exports = { canAdminPortalDeleteTdBooking };
