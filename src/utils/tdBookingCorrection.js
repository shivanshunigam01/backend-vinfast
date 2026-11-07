const ApiError = require('./apiError');
const TDVehicle = require('../models/TDVehicle');
const TDCustomer = require('../models/TDCustomer');
const TestDrive = require('../models/TestDrive');
const Lead = require('../models/Lead');
const { getActiveModelNames } = require('./vehicleCatalog');
const { parseSlotDate } = require('./reportPeriod');
const { normalizeSlotTime } = require('./tdBookingSync');
const { hasCustomModuleAcl, canPerformAction } = require('./modulePermissions');

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'MISSED'];
const MOBILE_10_REGEX = /^[6-9]\d{9}$/;

function assertTdBookingManagerEdit(admin) {
  if (admin?.userType === 'admin') return;
  if (['manager', 'superadmin'].includes(admin?.role)) return;
  if (hasCustomModuleAcl(admin) && canPerformAction(admin, 'td_bookings', 'update')) return;
  throw new ApiError(403, 'Only managers and admins can edit booking details');
}

/**
 * Managers/admins may correct customer identity, model, trim, slot, and remarks
 * on open bookings (not completed/cancelled/missed).
 */
async function applyTdBookingCorrections(doc, body = {}) {
  if (TERMINAL_STATUSES.includes(doc.bookingStatus)) {
    throw new ApiError(
      400,
      `Cannot edit a ${String(doc.bookingStatus).toLowerCase()} test drive booking. Book a new drive instead.`,
    );
  }

  const {
    customerName,
    customerMobile,
    customerEmail,
    customerCity,
    preferredModel,
    preferredVariant,
    slotDate,
    slotTime,
    remarks,
    syncLeadModel,
  } = body;

  const name = customerName !== undefined ? String(customerName).trim() : undefined;
  if (name !== undefined && !name) throw new ApiError(400, 'Customer name cannot be empty');

  let mobile;
  if (customerMobile !== undefined) {
    mobile = String(customerMobile).replace(/\D/g, '').slice(-10);
    if (!MOBILE_10_REGEX.test(mobile)) {
      throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number');
    }
  }

  const email = customerEmail !== undefined ? String(customerEmail).trim() : undefined;
  const city = customerCity !== undefined ? String(customerCity).trim() : undefined;

  let model;
  if (preferredModel !== undefined) {
    model = String(preferredModel).trim();
    const validModels = await getActiveModelNames();
    if (!validModels.includes(model)) {
      throw new ApiError(400, `Invalid model. Use one of: ${validModels.join(', ')}`);
    }
  }

  let variant;
  if (preferredVariant !== undefined) {
    variant = String(preferredVariant).trim() || undefined;
  }

  if (name !== undefined) doc.customerName = name;
  if (mobile !== undefined) doc.customerMobile = mobile;
  if (email !== undefined) doc.customerEmail = email || undefined;
  if (city !== undefined) doc.customerCity = city || undefined;
  if (remarks !== undefined) doc.remarks = String(remarks).trim() || undefined;

  if (model !== undefined && doc.preferredModel !== model) {
    doc.preferredModel = model;
    if (doc.vehicleId) {
      const assigned = await TDVehicle.findById(doc.vehicleId._id || doc.vehicleId);
      if (assigned && assigned.model !== model) {
        if (['BOOKED', 'AVAILABLE'].includes(assigned.status)) {
          assigned.status = 'AVAILABLE';
          await assigned.save();
        }
        doc.vehicleId = undefined;
      }
    }
  }

  if (variant !== undefined) {
    doc.preferredVariant = variant;
  }

  if (slotDate !== undefined) {
    const nextDate = parseSlotDate(slotDate);
    if (!nextDate) throw new ApiError(400, 'Invalid slotDate');
    doc.slotDate = nextDate;
  }
  if (slotTime !== undefined) {
    const t = String(slotTime).trim();
    if (!t) throw new ApiError(400, 'slotTime cannot be empty');
    doc.slotTime = normalizeSlotTime(t);
  }

  const openStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'];
  if (openStatuses.includes(doc.bookingStatus) && (slotDate !== undefined || slotTime !== undefined)) {
    if (doc.bookingStatus !== 'IN_PROGRESS') {
      doc.bookingStatus = 'RESCHEDULED';
    }
  }

  await doc.save();

  const customerRef = doc.customerId?._id || doc.customerId;
  if (customerRef && (name !== undefined || mobile !== undefined || email !== undefined || city !== undefined)) {
    const update = {};
    if (name !== undefined) update.name = name;
    if (mobile !== undefined) update.mobile = mobile;
    if (email !== undefined) update.email = email || undefined;
    if (city !== undefined) update.city = city || undefined;
    await TDCustomer.updateOne({ _id: customerRef }, { $set: update });
  }

  const testDriveRef = doc.testDriveId?._id || doc.testDriveId;
  if (testDriveRef) {
    const update = {};
    if (name !== undefined) update.customerName = name;
    if (mobile !== undefined) update.mobile = mobile;
    if (email !== undefined) update.email = email || undefined;
    if (city !== undefined) update.city = city || undefined;
    if (model !== undefined) update.model = model;
    if (variant !== undefined) update.variant = variant;
    if (remarks !== undefined) update.remarks = String(remarks).trim() || undefined;
    if (Object.keys(update).length) {
      await TestDrive.updateOne({ _id: testDriveRef }, { $set: update }, { runValidators: true });
    }
  }

  if (syncLeadModel !== false && model !== undefined && doc.leadId) {
    const lead = await Lead.findById(doc.leadId._id || doc.leadId);
    if (lead) {
      const storedVariant = variant !== undefined ? variant : doc.preferredVariant;
      const nextModel = storedVariant ? `${model} ${storedVariant}`.trim() : model;
      if (lead.model !== nextModel) {
        lead.model = nextModel;
        await lead.save();
      }
    }
  }

  return doc;
}

module.exports = {
  assertTdBookingManagerEdit,
  applyTdBookingCorrections,
  TERMINAL_STATUSES,
};
