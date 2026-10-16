/**
 * VinFast CRM export: "Total TD MTD.xlsx" (Associated Lead columns + TD fields).
 */
const TestDrive = require('../models/TestDrive');
const TDBooking = require('../models/TDBooking');
const { upsertTDCustomer } = require('./tdCustomerResolver');
const { normalizeModel } = require('./tdVehicleLegacyImport');
const { nextBookingId, resolveBranch, normalizeSlotTime } = require('./tdBookingSync');
const { intakePvLead } = require('./pvLeadIntake');
const { indiaDateKey } = require('./indiaDateTime');
const { touchLeadActivity } = require('./leadAssignment');

const COL_PHONE = 'Associated Lead: Phone';
const COL_SOURCE = 'Associated Lead: Lead Source';
const COL_VEHICLE = 'Preferred Vehicle';
const COL_CREATED = 'Created Date';
const COL_LOCATION = 'Location';
const COL_STATUS = 'Status';

const IMPORT_SOURCE = 'total_td_mtd';

function isTotalTdMtdSheet(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const keys = Object.keys(rows[0] || {});
  return keys.includes(COL_PHONE) && keys.includes(COL_VEHICLE) && keys.includes(COL_STATUS);
}

function normalizeMobile(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  return digits.slice(-10);
}

function parseCreatedDate(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const key = indiaDateKey(raw);
    return new Date(`${key}T00:00:00+05:30`);
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n > 30000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + n * 86400000);
    const key = indiaDateKey(d);
    return new Date(`${key}T00:00:00+05:30`);
  }
  const parsed = new Date(String(raw || '').trim());
  if (!Number.isNaN(parsed.getTime())) {
    const key = indiaDateKey(parsed);
    return new Date(`${key}T00:00:00+05:30`);
  }
  return null;
}

function mapBookingStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'completed') return 'COMPLETED';
  if (s === 'assigned') return 'CONFIRMED';
  if (s === 'cancelled') return 'CANCELLED';
  return 'CONFIRMED';
}

function mapTestDriveStatus(bookingStatus) {
  return bookingStatus === 'COMPLETED' ? 'Completed' : 'Scheduled';
}

function mapLeadStatus(bookingStatus) {
  return bookingStatus === 'COMPLETED' ? 'Test Drive Completed' : 'Test Drive Booked';
}

function mapPreferredLocation(raw) {
  const l = String(raw || '').trim().toLowerCase();
  if (l.includes('home') || l.includes('office')) return 'Home Test Drive';
  if (l.includes('dealer') || l.includes('showroom') || l.includes('visit')) return 'Dealership Visit';
  return undefined;
}

function mapLeadSource(raw) {
  const src = String(raw || '').trim();
  return src || 'Social Media';
}

function monthStartIndia(d) {
  const key = indiaDateKey(d);
  const [y, m] = key.split('-');
  return new Date(`${y}-${m}-01T00:00:00+05:30`);
}

function buildImportKey({ mobile, slotDate, model, status }) {
  const day = indiaDateKey(slotDate);
  return `${IMPORT_SOURCE}:${mobile}:${day}:${model}:${String(status).toLowerCase()}`;
}

function rowToPayload(row, rowIndex) {
  const mobile = normalizeMobile(row[COL_PHONE]);
  if (!mobile) {
    return { error: `Row ${rowIndex + 2}: invalid phone` };
  }
  const slotDate = parseCreatedDate(row[COL_CREATED]);
  if (!slotDate) {
    return { error: `Row ${rowIndex + 2}: invalid created date` };
  }
  const model = normalizeModel(row[COL_VEHICLE] || 'VF 7');
  const bookingStatus = mapBookingStatus(row[COL_STATUS]);
  const source = mapLeadSource(row[COL_SOURCE]);
  const locationRaw = String(row[COL_LOCATION] || '').trim();
  const preferredLocation = mapPreferredLocation(locationRaw);

  return {
    mobile,
    slotDate,
    model,
    bookingStatus,
    source,
    locationRaw,
    preferredLocation,
    importKey: buildImportKey({
      mobile,
      slotDate,
      model,
      status: row[COL_STATUS],
    }),
    sheetRow: rowIndex + 2,
  };
}

async function importTotalTdMtdRows(admin, rows, { dryRun = false } = {}) {
  if (!isTotalTdMtdSheet(rows)) {
    throw new Error('Not a Total TD MTD sheet (expected Associated Lead: Phone, Preferred Vehicle, Status columns)');
  }

  const branch = await resolveBranch('Patna Showroom');
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: [],
  };

  for (let i = 0; i < rows.length; i += 1) {
    const payload = rowToPayload(rows[i], i);
    if (payload.error) {
      results.failed.push({ row: i + 2, message: payload.error });
      continue;
    }

    const existing = await TDBooking.findOne({ vinfastImportKey: payload.importKey });
    if (existing && dryRun) {
      results.skipped += 1;
      continue;
    }

    try {
      if (dryRun) {
        results.created += 1;
        continue;
      }

      const customer = await upsertTDCustomer({
        name: `Customer ${payload.mobile}`,
        mobile: payload.mobile,
      });

      let booking = existing;
      let testDrive = booking?.testDriveId
        ? await TestDrive.findById(booking.testDriveId)
        : null;

      if (!testDrive) {
        testDrive = await TestDrive.create({
          customerName: customer.name || `Customer ${payload.mobile}`,
          mobile: payload.mobile,
          model: payload.model,
          city: 'Patna',
          preferredDate: payload.slotDate,
          preferredTime: '10:00',
          branch: branch.name,
          preferredTestDriveLocation: payload.preferredLocation,
          remarks: [
            'Imported: Total TD MTD',
            payload.locationRaw ? `Location: ${payload.locationRaw}` : null,
            `Source: ${payload.source}`,
          ]
            .filter(Boolean)
            .join(' · '),
          status: mapTestDriveStatus(payload.bookingStatus),
        });
      } else {
        testDrive.model = payload.model;
        testDrive.preferredDate = payload.slotDate;
        testDrive.status = mapTestDriveStatus(payload.bookingStatus);
        if (payload.preferredLocation) testDrive.preferredTestDriveLocation = payload.preferredLocation;
        await testDrive.save();
      }

      if (!booking) {
        booking = await TDBooking.create({
          bookingId: nextBookingId(),
          bookingStatus: payload.bookingStatus,
          slotDate: payload.slotDate,
          slotTime: normalizeSlotTime('10:00'),
          slotDuration: 60,
          preferredModel: payload.model,
          customerId: customer._id,
          branchId: branch._id,
          testDriveId: testDrive._id,
          customerName: customer.name,
          customerMobile: payload.mobile,
          customerCity: 'Patna',
          remarks: testDrive.remarks,
          vinfastImportSource: IMPORT_SOURCE,
          vinfastImportKey: payload.importKey,
          importMonthYear: monthStartIndia(payload.slotDate),
          assignmentStatus: 'UNASSIGNED',
        });
        results.created += 1;
      } else {
        booking.bookingStatus = payload.bookingStatus;
        booking.slotDate = payload.slotDate;
        booking.preferredModel = payload.model;
        booking.testDriveId = testDrive._id;
        booking.importMonthYear = monthStartIndia(payload.slotDate);
        booking.vinfastImportSource = IMPORT_SOURCE;
        booking.vinfastImportKey = payload.importKey;
        await booking.save();
        results.updated += 1;
      }

      const { lead } = await intakePvLead({
        name: customer.name,
        mobile: payload.mobile,
        model: payload.model,
        source: payload.source,
        status: mapLeadStatus(payload.bookingStatus),
        interest: 'Test Drive',
        testDriveId: testDrive._id,
        tdBookingId: booking._id,
        remarks: testDrive.remarks,
        changedBy: admin?._id,
        historyReason: `Imported Total TD MTD (row ${payload.sheetRow})`,
        forceNew: false,
      });

      if (lead) {
        lead.tdBookingId = booking._id;
        lead.creSheet = {
          ...(lead.creSheet || {}),
          tdDate: payload.slotDate,
          tdDone: payload.bookingStatus === 'COMPLETED',
          monthYearTd: monthStartIndia(payload.slotDate),
          afterTdRemark: payload.locationRaw || lead.creSheet?.afterTdRemark,
        };
        if (!lead.source || lead.source === 'Walk-in') {
          lead.source = payload.source;
        }
        touchLeadActivity(lead);
        await lead.save();
      }
    } catch (err) {
      results.failed.push({
        row: payload.sheetRow,
        mobile: payload.mobile,
        message: err.message || String(err),
      });
    }
  }

  return results;
}

module.exports = {
  IMPORT_SOURCE,
  COL_PHONE,
  COL_SOURCE,
  COL_VEHICLE,
  COL_CREATED,
  COL_LOCATION,
  COL_STATUS,
  isTotalTdMtdSheet,
  importTotalTdMtdRows,
  rowToPayload,
};
