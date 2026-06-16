function normalizeMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function mobileVariants(normalized) {
  if (!normalized) return [];
  return [normalized, `+91${normalized}`, `91${normalized}`];
}

function isValidIndianMobile(normalized) {
  return /^[6-9]\d{9}$/.test(normalized);
}

module.exports = { normalizeMobile, mobileVariants, isValidIndianMobile };
