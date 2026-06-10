const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const DemoVehicle = require('../models/DemoVehicle');
const DrivingLicense = require('../models/DrivingLicense');
const Lead = require('../models/Lead');
const LeadStageHistory = require('../models/LeadStageHistory');
const VehicleStatusLog = require('../models/VehicleStatusLog');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

const NON_BOOKABLE_STATUSES = ['Booked', 'Running', 'Charging', 'Under Repair', 'Battery Low'];

// Helper: push lead stage
const pushLeadStage = async (leadId, toStage, adminId, bookingId, type = 'Admin') => {
  if (!leadId) return;
  const lead = await Lead.findById(leadId);
  if (!lead) return;
  const fromStage = lead.status;
  lead.status = toStage;
  await lead.save();
  await LeadStageHistory.create({ lead: leadId, fromStage, toStage, changedBy: adminId, changedByType: type, relatedBooking: bookingId });
};

// POST /td/bookings — customer creates booking
exports.createBooking = asyncHandler(async (req, res) => {
  const {
    customerName, customerMobile, customerEmail,
    modelRequested, variantRequested,
    branchId, preferredDate, slotStart, slotEnd,
    leadId, utmSource, utmMedium, utmCampaign
  } = req.body;

  if (!customerName || !customerMobile || !modelRequested || !branchId || !preferredDate || !slotStart || !slotEnd) {
    throw new ApiError(400, 'Missing required booking fields');
  }

  const customerId = req.customer?._id || null;

  // Check driving license if customer is logged in
  if (customerId) {
    const license = await DrivingLicense.findOne({ customerId });
    if (!license) throw new ApiError(400, 'Please upload your driving license before booking');
    if (license.verificationStatus !== 'Verified') {
      throw new ApiError(400, `Driving license is ${license.verificationStatus}. Please wait for verification or re-upload.`);
    }
    if (license.expiryDate < new Date()) {
      throw new ApiError(400, 'Your driving license has expired. Please renew before booking.');
    }
  }

  // Find available vehicle for the requested model/branch
  const vehicle = await DemoVehicle.findOne({
    model: modelRequested,
    assignedBranch: branchId,
    active: true,
    status: 'Available',
    ...(variantRequested && { variant: variantRequested })
  });

  // Check slot conflict (even without specific vehicle)
  const startOfDay = new Date(preferredDate);
  const endOfDay = new Date(preferredDate);
  endOfDay.setHours(23, 59, 59, 999);

  if (vehicle) {
    const conflict = await TDBooking.findOne({
      assignedVehicle: vehicle._id,
      preferredDate: { $gte: startOfDay, $lte: endOfDay },
      slotStart,
      status: { $nin: ['Cancelled', 'No Show'] }
    });
    if (conflict) throw new ApiError(409, 'This slot is already booked. Please choose another slot.');
  }

  // Determine slot duration
  const [sh, sm] = slotStart.split(':').map(Number);
  const [eh, em] = slotEnd.split(':').map(Number);
  const slotDuration = (eh * 60 + em) - (sh * 60 + sm);

  const booking = await TDBooking.create({
    customer: customerId,
    customerName, customerMobile, customerEmail,
    drivingLicense: customerId ? (await DrivingLicense.findOne({ customerId }))?._id : undefined,
    licenseVerified: !!customerId,
    modelRequested, variantRequested,
    assignedVehicle: vehicle?._id,
    branch: branchId,
    preferredDate: new Date(preferredDate),
    slotStart, slotEnd, slotDuration,
    leadId, utmSource, utmMedium, utmCampaign,
    status: vehicle ? 'Approved' : 'Pending Approval'
  });

  // Lock vehicle if assigned
  if (vehicle) {
    vehicle.status = 'Booked';
    await vehicle.save();
    await VehicleStatusLog.create({
      vehicle: vehicle._id, fromStatus: 'Available', toStatus: 'Booked',
      reason: `Booked for booking ${booking.bookingRef}`, relatedBooking: booking._id
    });
  }

  // Update lead stage
  if (leadId) await pushLeadStage(leadId, 'Test Drive Booked', null, booking._id, 'System');

  res.status(201).json({
    success: true,
    message: 'Test drive booking submitted successfully!',
    data: { bookingRef: booking.bookingRef, status: booking.status, _id: booking._id }
  });
});

// GET /admin/td/bookings
exports.getBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.model) query.modelRequested = req.query.model;
  if (req.query.branch) query.branch = req.query.branch;
  if (req.query.executive) query.assignedExecutive = req.query.executive;
  if (req.query.date) {
    const d = new Date(req.query.date);
    const n = new Date(req.query.date); n.setDate(n.getDate() + 1);
    query.preferredDate = { $gte: d, $lt: n };
  }
  if (req.query.search) {
    const r = new RegExp(req.query.search.trim(), 'i');
    query.$or = [{ customerName: r }, { customerMobile: r }, { bookingRef: r }];
  }

  const [docs, total] = await Promise.all([
    TDBooking.find(query)
      .populate('assignedVehicle', 'vehicleId model variant registrationNumber')
      .populate('assignedExecutive', 'name email')
      .populate('branch', 'name city')
      .populate('customer', 'customerId name')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query)
  ]);
  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

// GET /admin/td/bookings/:id
exports.getBookingById = asyncHandler(async (req, res) => {
  const doc = await TDBooking.findById(req.params.id)
    .populate('assignedVehicle')
    .populate('assignedExecutive', 'name email role')
    .populate('branch')
    .populate('customer')
    .populate('drivingLicense');
  if (!doc) throw new ApiError(404, 'Booking not found');
  const tdLog = await TDLog.findOne({ booking: doc._id });
  res.json({ success: true, data: { booking: doc, tdLog } });
});

// PUT /admin/td/bookings/:id/approve
exports.approveBooking = asyncHandler(async (req, res) => {
  const { vehicleId } = req.body;
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!['Pending Approval'].includes(booking.status)) throw new ApiError(400, `Cannot approve booking in status: ${booking.status}`);

  if (vehicleId) {
    const vehicle = await DemoVehicle.findById(vehicleId);
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    if (NON_BOOKABLE_STATUSES.includes(vehicle.status)) throw new ApiError(400, `Vehicle is ${vehicle.status}`);
    booking.assignedVehicle = vehicle._id;
    vehicle.status = 'Booked';
    await vehicle.save();
    await VehicleStatusLog.create({ vehicle: vehicle._id, fromStatus: vehicle.status, toStatus: 'Booked', changedBy: req.admin._id, reason: 'Booking approved', relatedBooking: booking._id });
  }

  booking.status = 'Approved';
  booking.approvedBy = req.admin._id;
  booking.approvedAt = new Date();
  await booking.save();

  res.json({ success: true, message: 'Booking approved', data: booking });
});

// PUT /admin/td/bookings/:id/assign-executive
exports.assignExecutive = asyncHandler(async (req, res) => {
  const { executiveId } = req.body;
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');

  booking.assignedExecutive = executiveId;
  booking.executiveAssignedAt = new Date();
  if (booking.status === 'Approved') booking.status = 'Assigned';
  await booking.save();

  res.json({ success: true, message: 'Executive assigned', data: booking });
});

// PUT /admin/td/bookings/:id/cancel
exports.cancelBooking = asyncHandler(async (req, res) => {
  const { reason, cancelledBy = 'Admin' } = req.body;
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (['Completed', 'Cancelled'].includes(booking.status)) throw new ApiError(400, 'Cannot cancel a completed or already cancelled booking');

  // Release vehicle
  if (booking.assignedVehicle) {
    await DemoVehicle.findByIdAndUpdate(booking.assignedVehicle, { status: 'Available' });
    await VehicleStatusLog.create({ vehicle: booking.assignedVehicle, fromStatus: 'Booked', toStatus: 'Available', reason: 'Booking cancelled', relatedBooking: booking._id });
  }

  booking.status = 'Cancelled';
  booking.cancellationReason = reason;
  booking.cancelledBy = cancelledBy;
  await booking.save();

  // Revert lead stage if needed
  if (booking.leadId) await pushLeadStage(booking.leadId, 'Interested', req.admin._id, booking._id);

  res.json({ success: true, message: 'Booking cancelled', data: booking });
});

// PUT /admin/td/bookings/:id/reschedule
exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const { preferredDate, slotStart, slotEnd } = req.body;
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (['Completed', 'Cancelled', 'In Progress'].includes(booking.status)) {
    throw new ApiError(400, 'Cannot reschedule this booking');
  }

  booking.preferredDate = new Date(preferredDate);
  booking.slotStart = slotStart;
  booking.slotEnd = slotEnd;
  const [sh, sm] = slotStart.split(':').map(Number);
  const [eh, em] = slotEnd.split(':').map(Number);
  booking.slotDuration = (eh * 60 + em) - (sh * 60 + sm);
  booking.status = 'Rescheduled';
  await booking.save();

  res.json({ success: true, message: 'Booking rescheduled', data: booking });
});

// GET /executive/td/bookings — executive sees own assigned bookings
exports.getExecutiveBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = { assignedExecutive: req.admin._id, status: { $nin: ['Cancelled'] } };
  if (req.query.date) {
    const d = new Date(req.query.date);
    const n = new Date(req.query.date); n.setDate(n.getDate() + 1);
    query.preferredDate = { $gte: d, $lt: n };
  }
  const [docs, total] = await Promise.all([
    TDBooking.find(query)
      .populate('assignedVehicle', 'vehicleId model variant registrationNumber batteryPercentage')
      .populate('branch', 'name city')
      .populate('customer', 'customerId name mobile')
      .sort({ preferredDate: 1, slotStart: 1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query)
  ]);
  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});
