/**
 * CRE "Current Format" Excel parser.
 * TD in column headers = Test Drive.
 */

const { CRM_LEAD_STAGES, normalizeStageLabel } = require('../constants/leadStages');
const { normalizeMobile } = require('./mobile');

/** Canonical Current Format headers (export / template). */
const CURRENT_FORMAT_HEADERS = [
  'Sl. No.',
  'ENQUIRY DATE',
  'LEAD SOURCE',
  'CUSTOMER NAME',
  'PHONE',
  'MAIL ID',
  'LOCATION',
  'EXISTING VARIANT',
  'MODEL',
  'CALL DATE',
  'INITIAL REMARK',
  'LEAD TYPE',
  'SALES CONSULTANT',
  'DATE',
  'SALES PERSON REMARK',
  'TD Date',
  'TD DONE\nYES/ NO',
  'TD NOT DONE,\nWHY?',
  'AFTER TD REMARK',
  'CRE Follow up call 1 Date',
  'CRE Follow up call remark 1',
  'Sales Person Follow up call 1 Date',
  'Sales Person Follow up call 1 Remark 1',
  'CRE Follow up call 2 Date',
  'CRE Follow up call remark 2',
  'Sales Person Follow up call remark 2 Date',
  'Sales Person Follow up call remark 2',
  'CRE Follow up call 3 Date',
  'CRE Follow up call remark 3',
  'Sales Person Follow up call remark 3 Date',
  'Sales Person Follow up call remark 3',
  'BOOKING DONE\nYES / NO',
  'BOOKING DATE',
  'FINAL MODEL',
  'FINAL VARIANT',
  'FINAL COLOUR',
  'MAIL SENT\nYES / NO',
  'EXCHANGE\nYES / NO',
  'RETAIL DONE\nYES / NO',
  'RETAIL DATE',
  'DELIVERY DATE',
];

function normalizeHeaderKey(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .toLowerCase()
    .replace(/\n+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\btd\b/g, 'test drive');
}

function buildHeaderMap(row) {
  const map = {};
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normalizeHeaderKey(k);
    if (nk) map[nk] = v;
  }
  return map;
}

function pickFromMap(map, aliases, { exactOnly = false } = {}) {
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (map[key] != null && String(map[key]).trim() !== '') return map[key];
  }
  if (exactOnly) return '';
  // Header contains the full alias (e.g. "test drive done yes no" contains "test drive done").
  // Do NOT match alias-contains-header (e.g. "test drive date" containing "date") — that
  // steals values from unrelated DATE / MODEL columns.
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (key.length <= 5) continue;
    for (const [hk, hv] of Object.entries(map)) {
      if (hk !== key && hk.includes(key) && hv != null && String(hv).trim() !== '') {
        return hv;
      }
    }
  }
  return '';
}

function cellStr(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Excel serial date or Date/string → Date | null */
function parseSheetDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial (days since 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + Math.round(v * 86400000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseYesNo(v) {
  const s = String(v ?? '')
    .trim()
    .toUpperCase();
  if (!s) return null;
  if (s === 'NO' || s === 'N' || s === 'FALSE' || s === '0') return false;
  if (s === 'YES' || s === 'Y' || s === 'TRUE' || s === '1') return true;
  if (s.startsWith('Y')) return true;
  if (s.startsWith('N')) return false;
  return null;
}

function isBlankEmail(v) {
  const s = cellStr(v).toLowerCase();
  return !s || s === 'no' || s === 'na' || s === 'n/a' || s === '-';
}

/**
 * Detect Current Format by presence of signature columns.
 */
function isCurrentFormatSheet(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const map = buildHeaderMap(rows[0]);
  const keys = Object.keys(map);
  const hasPhone = keys.some((k) => k === 'phone' || k.includes('phone'));
  const hasCustomer =
    keys.some((k) => k.includes('customer name')) || keys.some((k) => k === 'customer name');
  const hasEnquiry = keys.some((k) => k.includes('enquiry date'));
  const hasTd =
    keys.some((k) => k.includes('test drive date') || k.includes('test drive done')) ||
    keys.some((k) => k.includes('td date') || k.includes('td done'));
  const hasLeadType = keys.some((k) => k.includes('lead type'));
  const hasSalesConsultant = keys.some((k) => k.includes('sales consultant'));
  // Strong signal: PHONE + CUSTOMER NAME + (ENQUIRY DATE or LEAD TYPE or TD)
  return hasPhone && hasCustomer && (hasEnquiry || hasLeadType || hasTd || hasSalesConsultant);
}

function mapLeadTypeToStatus(leadType, status) {
  if (status && CRM_LEAD_STAGES.includes(status)) return status;
  const t = String(leadType || '').trim().toUpperCase();
  if (!t) return 'Enquiry';
  if (t.includes('LOST') || t.includes('NOT INTEREST')) return 'Lost';
  if (t.includes('HOT') || t.includes('WARM')) return 'Interested';
  if (t.includes('COLD') || t.includes('FOLLOW') || t.includes('NOT CONNECT')) return 'Enquiry';
  if (CRM_LEAD_STAGES.includes(leadType)) return leadType;
  return 'Enquiry';
}

/**
 * Derive CRM pipeline stage from sheet flags (highest wins).
 * Explicit LEAD TYPE Lost beats TD flags (CRE often marks Lost after a drive).
 * Retail / Booking still win over Lost (completed sale).
 */
function deriveStatusFromSheet({ retailDone, deliveryDate, bookingDone, tdDone, tdDate, leadType }) {
  if (retailDone === true || deliveryDate) return 'Delivered';
  if (bookingDone === true) return 'Booking';
  const t = String(leadType || '').trim().toUpperCase();
  if (t.includes('LOST') || t.includes('NOT INTEREST')) return 'Lost';
  if (tdDone === true) return 'Test Drive Completed';
  if (tdDate && tdDone !== true) return 'Test Drive Booked';
  return mapLeadTypeToStatus(leadType);
}

function normalizeImportModel(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'VF 7';
  const upper = s.toUpperCase().replace(/\s+/g, ' ');
  if (upper.includes(',') || upper.includes('/')) return 'Both';
  if (upper.includes('LIMO')) return 'Limo Green';
  if (upper.includes('MPV')) return 'VF MPV 7';
  if (upper.includes('VF 6') || upper === 'VF6') return 'VF 6';
  if (upper.includes('VF 7') || upper === 'VF7') return 'VF 7';
  if (upper.includes('VF 3') || upper === 'VF3') return 'VF 7';
  return s;
}

function pushFollowUp(list, note, dateVal, prefix) {
  const remark = cellStr(note);
  if (!remark) return;
  const scheduled = parseSheetDate(dateVal);
  list.push({
    note: `${prefix}${remark}`,
    scheduledAt: scheduled ? scheduled.toISOString() : undefined,
  });
}

/**
 * Parse one Current Format row into a normalized import payload.
 */
function parseCurrentFormatRow(row) {
  const map = buildHeaderMap(row);

  const name = cellStr(pickFromMap(map, ['customer name', 'name']));
  const mobileRaw = pickFromMap(map, ['phone', 'mobile', 'mobile number', 'contact']);
  const mobile = normalizeMobile(mobileRaw) || String(mobileRaw || '').replace(/\D/g, '').slice(-10);

  const mailRaw = pickFromMap(map, ['mail id', 'email', 'email id']);
  const email = isBlankEmail(mailRaw) ? undefined : cellStr(mailRaw).toLowerCase();

  const city = cellStr(pickFromMap(map, ['location', 'city', 'area'])) || 'Patna';
  const modelRaw = cellStr(pickFromMap(map, ['model', 'interested model']));
  const model = normalizeImportModel(modelRaw);
  const source = cellStr(pickFromMap(map, ['lead source', 'source'])) || 'Excel Import';
  const leadType = cellStr(pickFromMap(map, ['lead type'])) || undefined;
  const salesConsultant = cellStr(pickFromMap(map, ['sales consultant'])) || undefined;

  const enquiryDate = parseSheetDate(pickFromMap(map, ['enquiry date']));
  const callDate = parseSheetDate(pickFromMap(map, ['call date']));
  const existingVariant = cellStr(pickFromMap(map, ['existing variant'])) || undefined;
  const initialRemark = cellStr(pickFromMap(map, ['initial remark'])) || undefined;
  const salesPersonDate = parseSheetDate(pickFromMap(map, ['date'], { exactOnly: true }));
  const salesPersonRemark = cellStr(pickFromMap(map, ['sales person remark'])) || undefined;

  const tdDate = parseSheetDate(pickFromMap(map, ['test drive date', 'td date']));
  const tdDoneRaw = pickFromMap(map, ['test drive done yes no', 'td done yes no', 'test drive done']);
  const tdDone = parseYesNo(tdDoneRaw);
  const tdNotDoneWhy =
    cellStr(pickFromMap(map, ['test drive not done why', 'td not done why'])) || undefined;
  const afterTdRemark =
    cellStr(pickFromMap(map, ['after test drive remark', 'after td remark'])) || undefined;

  const bookingDone = parseYesNo(
    pickFromMap(map, ['booking done yes no', 'booking done']),
  );
  const bookingDate = parseSheetDate(pickFromMap(map, ['booking date']));
  const finalModel = cellStr(pickFromMap(map, ['final model'])) || undefined;
  const finalVariant = cellStr(pickFromMap(map, ['final variant'])) || undefined;
  const finalColour = cellStr(pickFromMap(map, ['final colour', 'final color'])) || undefined;
  const mailSent = parseYesNo(pickFromMap(map, ['mail sent yes no', 'mail sent']));
  const exchangeNeeded = parseYesNo(pickFromMap(map, ['exchange yes no', 'exchange'])) === true;
  const retailDone = parseYesNo(pickFromMap(map, ['retail done yes no', 'retail done']));
  const retailDate = parseSheetDate(pickFromMap(map, ['retail date']));
  const deliveryDate = parseSheetDate(pickFromMap(map, ['delivery date']));

  const remarkParts = [];
  if (initialRemark) remarkParts.push(`Initial: ${initialRemark}`);
  if (salesPersonRemark) remarkParts.push(`Sales: ${salesPersonRemark}`);
  if (afterTdRemark) remarkParts.push(`After TD: ${afterTdRemark}`);
  if (tdNotDoneWhy) remarkParts.push(`TD not done: ${tdNotDoneWhy}`);
  if (existingVariant && existingVariant.toUpperCase() !== 'NO') {
    remarkParts.push(`Existing variant: ${existingVariant}`);
  }

  const followUps = [];
  pushFollowUp(
    followUps,
    pickFromMap(map, ['cre follow up call remark 1', 'cre follow up call 1 remark']),
    pickFromMap(map, ['cre follow up call 1 date']),
    'CRE #1: ',
  );
  pushFollowUp(
    followUps,
    pickFromMap(map, [
      'sales person follow up call 1 remark 1',
      'sales person follow up call 1 remark',
    ]),
    pickFromMap(map, ['sales person follow up call 1 date']),
    'Sales #1: ',
  );
  pushFollowUp(
    followUps,
    pickFromMap(map, ['cre follow up call remark 2', 'cre follow up call 2 remark']),
    pickFromMap(map, ['cre follow up call 2 date']),
    'CRE #2: ',
  );
  pushFollowUp(
    followUps,
    pickFromMap(map, ['sales person follow up call remark 2', 'sales person follow up call 2 remark']),
    pickFromMap(map, [
      'sales person follow up call remark 2 date',
      'sales person follow up call 2 date',
    ]),
    'Sales #2: ',
  );
  pushFollowUp(
    followUps,
    pickFromMap(map, ['cre follow up call remark 3', 'cre follow up call 3 remark']),
    pickFromMap(map, ['cre follow up call 3 date']),
    'CRE #3: ',
  );
  pushFollowUp(
    followUps,
    pickFromMap(map, ['sales person follow up call remark 3', 'sales person follow up call 3 remark']),
    pickFromMap(map, [
      'sales person follow up call remark 3 date',
      'sales person follow up call 3 date',
    ]),
    'Sales #3: ',
  );

  const derivedStatus = deriveStatusFromSheet({
    retailDone,
    deliveryDate,
    bookingDone,
    tdDone,
    tdDate,
    leadType,
  });

  const creSheet = {
    enquiryDate: enquiryDate || undefined,
    callDate: callDate || undefined,
    existingVariant: existingVariant || undefined,
    salesConsultantName: salesConsultant || undefined,
    salesPersonDate: salesPersonDate || undefined,
    salesPersonRemark: salesPersonRemark || undefined,
    tdDate: tdDate || undefined,
    tdDone: tdDone == null ? undefined : tdDone,
    tdNotDoneWhy: tdNotDoneWhy || undefined,
    afterTdRemark: afterTdRemark || undefined,
    bookingDone: bookingDone == null ? undefined : bookingDone,
    bookingDate: bookingDate || undefined,
    finalModel: finalModel || undefined,
    finalVariant: finalVariant || undefined,
    finalColour: finalColour || undefined,
    mailSent: mailSent == null ? undefined : mailSent,
    retailDone: retailDone == null ? undefined : retailDone,
    retailDate: retailDate || undefined,
    deliveryDate: deliveryDate || undefined,
    initialRemark: initialRemark || undefined,
  };

  return {
    name,
    mobile,
    email,
    city,
    area: city,
    model,
    modelRaw: modelRaw || undefined,
    source,
    leadType,
    salesConsultant,
    remarks: remarkParts.filter(Boolean).join('\n') || undefined,
    exchangeNeeded,
    enquiryDate: enquiryDate ? enquiryDate.toISOString() : undefined,
    followUps,
    creSheet,
    derivedStatus: normalizeStageLabel(derivedStatus) || 'Enquiry',
  };
}

/**
 * Advance stage only forward; Lost may reopen when sheet is active.
 */
function pickForwardStage(currentStatus, incomingStatus) {
  const prev = normalizeStageLabel(currentStatus);
  const next = normalizeStageLabel(incomingStatus);
  if (prev === 'Lost' && next !== 'Lost') return next;
  const prevIdx = CRM_LEAD_STAGES.indexOf(prev);
  const nextIdx = CRM_LEAD_STAGES.indexOf(next);
  if (nextIdx === -1) return prev;
  if (prevIdx === -1) return next;
  return nextIdx >= prevIdx ? next : prev;
}

module.exports = {
  CURRENT_FORMAT_HEADERS,
  normalizeHeaderKey,
  isCurrentFormatSheet,
  parseCurrentFormatRow,
  deriveStatusFromSheet,
  mapLeadTypeToStatus,
  normalizeImportModel,
  pickForwardStage,
  parseSheetDate,
  parseYesNo,
  cellStr,
};
