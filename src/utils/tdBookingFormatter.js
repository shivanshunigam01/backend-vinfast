const { extractCustomerFromBooking } = require('./tdCustomerResolver');

const DESIGNATION_LABELS = {
  sales_executive: 'Sales Executive',
  cre: 'CRE',
  crm: 'CRM',
  sales_manager: 'Sales Manager',
  sales_head: 'Sales Head',
  branch_manager: 'Branch Manager',
  gm: 'General Manager',
  ceo: 'CEO',
  md: 'Managing Director',
};

function isPlaceholderCustomerName(name, mobile) {
  const n = String(name || '').trim();
  if (!n || /^customer$/i.test(n)) return true;
  const m = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (m && (n === m || n.replace(/\D/g, '').endsWith(m))) return true;
  if (/^\d{10}$/.test(n.replace(/\s/g, ''))) return true;
  return false;
}

function formatCustomer(customer) {
  if (!customer || typeof customer !== 'object') return null;
  const name = customer.name || customer.customerName;
  const mobile = customer.mobile || customer.phone;
  if (!name && !mobile) return null;
  return {
    _id: customer._id,
    name: name || 'Customer',
    mobile: mobile || '',
    customerId: customer.customerId,
    email: customer.email,
    city: customer.city,
  };
}

function formatVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') return null;
  return {
    _id: vehicle._id,
    vehicleId: vehicle.vehicleId,
    model: vehicle.model,
    variant: vehicle.variant,
    registrationNo: vehicle.registrationNo,
    color: vehicle.color,
    status: vehicle.status,
    batteryPercent: vehicle.batteryPercent,
    currentOdometer: vehicle.currentOdometer,
  };
}

function formatExecutive(executive) {
  if (!executive || typeof executive !== 'object') return null;
  return {
    _id: executive._id,
    name: executive.name,
    email: executive.email,
    role: executive.role,
    designation: executive.designation,
    designationLabel: DESIGNATION_LABELS[executive.designation] || executive.designation,
  };
}

function formatBranch(branch) {
  if (!branch || typeof branch !== 'object') return null;
  return {
    _id: branch._id,
    name: branch.name,
    code: branch.code,
  };
}

function formatTestDrive(testDrive) {
  if (!testDrive || typeof testDrive !== 'object') return null;
  return {
    _id: testDrive._id,
    customerName: testDrive.customerName,
    mobile: testDrive.mobile,
    email: testDrive.email,
    city: testDrive.city,
    model: testDrive.model,
    variant: testDrive.variant,
    preferredTestDriveLocation: testDrive.preferredTestDriveLocation,
    ownsCar: testDrive.ownsCar,
    currentCarDetails: testDrive.currentCarDetails,
    purchaseTimeline: testDrive.purchaseTimeline,
    remarks: testDrive.remarks,
    status: testDrive.status,
  };
}

function resolveCustomerForBooking(plain) {
  const denormName = String(plain.customerName || '').trim();
  const denormMobile = String(plain.customerMobile || '').replace(/\D/g, '').slice(-10);

  const fromRef = formatCustomer(plain.customerId);
  const td = formatTestDrive(plain.testDriveId);
  const extracted = extractCustomerFromBooking(plain);

  const candidates = [
    { name: denormName, mobile: denormMobile || fromRef?.mobile },
    { name: td?.customerName, mobile: td?.mobile },
    { name: extracted?.name, mobile: extracted?.mobile, email: extracted?.email, city: extracted?.city },
    { name: fromRef?.name, mobile: fromRef?.mobile, email: fromRef?.email, city: fromRef?.city },
  ];

  let best = candidates.find((c) => c.name && !isPlaceholderCustomerName(c.name, c.mobile));
  if (!best) best = candidates.find((c) => c.name || c.mobile);
  if (!best && !fromRef && !extracted && !td?.mobile) return null;

  const mobile =
    best?.mobile ||
    fromRef?.mobile ||
    extracted?.mobile ||
    td?.mobile ||
    denormMobile ||
    '';
  const name =
    (best?.name && !isPlaceholderCustomerName(best.name, mobile) ? best.name : null) ||
    denormName ||
    td?.customerName ||
    extracted?.name ||
    fromRef?.name ||
    (mobile ? 'Customer' : 'Customer');

  return {
    _id:
      plain.customerId && typeof plain.customerId === 'object'
        ? plain.customerId._id
        : plain.customerId,
    name,
    mobile,
    customerId: extracted?.customerId || fromRef?.customerId,
    email: best?.email || fromRef?.email || td?.email || extracted?.email,
    city: best?.city || fromRef?.city || td?.city || extracted?.city,
  };
}

function formatTdBooking(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: plain._id,
    bookingId: plain.bookingId,
    bookingStatus: plain.bookingStatus,
    slotDate: plain.slotDate,
    slotTime: plain.slotTime,
    slotDuration: plain.slotDuration,
    dlVerified: Boolean(plain.dlVerified),
    dlImageUrl: plain.dlImageUrl || null,
    dlVerifiedAt: plain.dlVerifiedAt || null,
    dlNumber: plain.dlNumber || null,
    dlValidUntil: plain.dlValidUntil || null,
    preferredModel: plain.preferredModel,
    remarks: plain.remarks,
    cancellationReason: plain.cancellationReason,
    isRepeatDrive: Boolean(plain.isRepeatDrive),
    approvalStatus: plain.approvalStatus || 'NOT_REQUIRED',
    approvalNote: plain.approvalNote || null,
    approvalDecidedAt: plain.approvalDecidedAt || null,
    approvalRequestedBy:
      plain.approvalRequestedBy && typeof plain.approvalRequestedBy === 'object'
        ? { _id: plain.approvalRequestedBy._id, name: plain.approvalRequestedBy.name }
        : plain.approvalRequestedBy || null,
    leadId: plain.leadId || null,
    assignmentStatus: plain.assignmentStatus || (plain.assignedExecutive ? 'ACCEPTED' : 'UNASSIGNED'),
    assignmentRespondedAt: plain.assignmentRespondedAt || null,
    assignmentRejectReason: plain.assignmentRejectReason || null,
    rescheduleCount: plain.rescheduleCount || 0,
    pendingRescheduleRequestId: plain.pendingRescheduleRequestId || null,
    customerLat: plain.customerLat ?? null,
    customerLng: plain.customerLng ?? null,
    customerAddress: plain.customerAddress || null,
    createdAt: plain.createdAt,
    customerId: resolveCustomerForBooking(plain),
    vehicleId: formatVehicle(plain.vehicleId),
    assignedExecutive: (() => {
      const formatted = formatExecutive(plain.assignedExecutive);
      if (formatted?.name) return formatted;
      const email = String(plain.assignedExecutiveEmail || '').trim();
      if (email) {
        return {
          _id: plain.assignedExecutive || null,
          name: email,
          email,
          role: null,
          designation: null,
          designationLabel: null,
        };
      }
      return formatted;
    })(),
    branchId: formatBranch(plain.branchId),
    testDriveId: formatTestDrive(plain.testDriveId),
    assignedExecutiveEmail: plain.assignedExecutiveEmail || plain.assignedExecutive?.email || null,
  };
}

module.exports = {
  DESIGNATION_LABELS,
  formatTdBooking,
  formatExecutive,
  resolveCustomerForBooking,
};
