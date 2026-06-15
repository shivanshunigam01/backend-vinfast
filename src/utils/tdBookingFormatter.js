const { extractCustomerFromBooking } = require('./tdCustomerResolver');

const DESIGNATION_LABELS = {
  sales_executive: 'Sales Executive',
  sales_manager: 'Sales Manager',
  branch_manager: 'Branch Manager',
  gm: 'GM',
  ceo: 'CEO',
  md: 'MD',
};

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
    vehicleId: vehicle.vehicleId,
    model: vehicle.model,
    registrationNo: vehicle.registrationNo,
    color: vehicle.color,
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
  const fromRef = formatCustomer(plain.customerId);
  if (fromRef?.name) return fromRef;

  const extracted = extractCustomerFromBooking(plain);
  if (extracted) {
    return {
      _id:
        plain.customerId && typeof plain.customerId === 'object'
          ? plain.customerId._id
          : plain.customerId,
      name: extracted.name,
      mobile: extracted.mobile,
      customerId: extracted.customerId,
      email: extracted.email,
      city: extracted.city,
    };
  }

  const td = formatTestDrive(plain.testDriveId);
  if (td?.customerName || td?.mobile) {
    return {
      _id:
        plain.customerId && typeof plain.customerId === 'object'
          ? plain.customerId._id
          : plain.customerId,
      name: td.customerName || 'Customer',
      mobile: td.mobile || '',
      email: td.email,
      city: td.city,
    };
  }

  return null;
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
    preferredModel: plain.preferredModel,
    remarks: plain.remarks,
    cancellationReason: plain.cancellationReason,
    createdAt: plain.createdAt,
    customerId: resolveCustomerForBooking(plain),
    vehicleId: formatVehicle(plain.vehicleId),
    assignedExecutive: formatExecutive(plain.assignedExecutive),
    branchId: formatBranch(plain.branchId),
    testDriveId: formatTestDrive(plain.testDriveId),
  };
}

module.exports = {
  DESIGNATION_LABELS,
  formatTdBooking,
  formatExecutive,
  resolveCustomerForBooking,
};
