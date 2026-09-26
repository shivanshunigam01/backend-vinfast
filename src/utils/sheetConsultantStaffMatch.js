const { isUnassignedConsultantName } = require('./leadUnassigned');

/** Normalized key from Excel SALES CONSULTANT (strips (SM)/(SE) suffix labels). */
function normalizeSheetConsultantKey(raw) {
  return String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Same aliases as CRE workbook import — keeps report counts aligned with sheets. */
const CONSULTANT_ALIASES = {
  'rahul singh 1': 'rahul singh',
  'rahul kumar 1': 'rahul kumar',
  'rahul singh': 'rahul singh',
  'rahul kumar sm': 'rahul kumar',
  'rahul kumar': 'rahul kumar',
  'saurav 1': 'saurav kumar',
  saurav: 'saurav kumar',
  'aditya sm': 'aditya',
  aditya: 'aditya',
  'dilip sm': 'dilip choudhary',
};

/**
 * Map sheet consultant label → TDStaff row (Excel MIS is source of truth for report attribution).
 * @param {string} consultantRaw creSheet.salesConsultantName
 * @param {Array<{ _id: unknown, name: string, designation?: string }>} staffRows
 */
function resolveSheetConsultantToStaff(consultantRaw, staffRows) {
  if (isUnassignedConsultantName(consultantRaw)) return null;
  if (!staffRows?.length) return null;

  let key = normalizeSheetConsultantKey(consultantRaw);
  if (!key) return null;

  const aliasTarget = CONSULTANT_ALIASES[key];
  if (aliasTarget) key = normalizeSheetConsultantKey(aliasTarget);

  let hit = staffRows.find((s) => normalizeSheetConsultantKey(s.name) === key);
  if (hit) return hit;

  hit = staffRows.find((s) => {
    const n = normalizeSheetConsultantKey(s.name);
    return n.includes(key) || key.includes(n);
  });
  if (hit) return hit;

  const firstToken = key.split(/\s+/)[0];
  if (firstToken && firstToken.length >= 3) {
    hit = staffRows.find((s) => {
      const n = normalizeSheetConsultantKey(s.name);
      return n === firstToken || n.startsWith(`${firstToken} `);
    });
  }
  return hit || null;
}

/**
 * Attribute leads/TDs by sheet consultant (not CRM assignedTo).
 */
function attributeLeadsBySheetConsultant(
  leads,
  staffRows,
  { mtdStart, mtdMonthEnd },
) {
  const leadByStaff = new Map();
  const tdByStaff = new Map();
  const matrixCounts = new Map();
  const unassigned = { totalLeads: 0, totalTestDrive: 0, totalTestDriveMtd: 0 };

  for (const lead of leads) {
    const staff = resolveSheetConsultantToStaff(lead.creSheet?.salesConsultantName, staffRows);
    const staffId = staff ? String(staff._id) : null;

    if (!staffId) {
      unassigned.totalLeads += 1;
    } else {
      leadByStaff.set(staffId, (leadByStaff.get(staffId) || 0) + 1);
      const source = lead.source || 'Unknown';
      const matrixKey = `${source}\x00${staffId}`;
      matrixCounts.set(matrixKey, (matrixCounts.get(matrixKey) || 0) + 1);
    }

    const tdDateRaw = lead.creSheet?.tdDate;
    const tdDone = lead.creSheet?.tdDone === true && tdDateRaw;
    if (!tdDone) continue;

    const tdDate = tdDateRaw instanceof Date ? tdDateRaw : new Date(tdDateRaw);
    if (Number.isNaN(tdDate.getTime())) continue;

    const inMtd = tdDate >= mtdStart && tdDate <= mtdMonthEnd;

    if (!staffId) {
      unassigned.totalTestDrive += 1;
      if (inMtd) unassigned.totalTestDriveMtd += 1;
    } else {
      const prev = tdByStaff.get(staffId) || { totalTd: 0, tdMtd: 0 };
      prev.totalTd += 1;
      if (inMtd) prev.tdMtd += 1;
      tdByStaff.set(staffId, prev);
    }
  }

  const matrixAgg = [];
  for (const [matrixKey, count] of matrixCounts) {
    const sep = matrixKey.indexOf('\x00');
    const source = matrixKey.slice(0, sep);
    const staffId = matrixKey.slice(sep + 1);
    matrixAgg.push({ _id: { source, staffId }, count });
  }

  return { leadByStaff, tdByStaff, matrixAgg, unassigned };
}

module.exports = {
  normalizeSheetConsultantKey,
  CONSULTANT_ALIASES,
  resolveSheetConsultantToStaff,
  attributeLeadsBySheetConsultant,
};
