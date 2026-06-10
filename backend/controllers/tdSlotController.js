const TDBooking = require('../models/TDBooking');
const DemoVehicle = require('../models/DemoVehicle');
const Branch = require('../models/Branch');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * Generate all time slots for a branch/vehicle on a given date
 * based on branch config (slotDuration + bufferTime).
 */
const generateSlots = (startTime, endTime, slotDuration, bufferTime) => {
  const slots = [];
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let current = sh * 60 + sm;
  const end = eh * 60 + em;
  const step = slotDuration + bufferTime;

  while (current + slotDuration <= end) {
    const toH = String(Math.floor(current / 60)).padStart(2, '0');
    const toM = String(current % 60).padStart(2, '0');
    const endC = current + slotDuration;
    const endH = String(Math.floor(endC / 60)).padStart(2, '0');
    const endM = String(endC % 60).padStart(2, '0');
    slots.push({ start: `${toH}:${toM}`, end: `${endH}:${endM}`, durationMins: slotDuration });
    current += step;
  }
  return slots;
};

// GET /td/slots/available?vehicleId=&date=YYYY-MM-DD
exports.getAvailableSlots = asyncHandler(async (req, res) => {
  const { vehicleId, date, branchId } = req.query;
  if (!date) throw new ApiError(400, 'date (YYYY-MM-DD) is required');

  const requestedDate = new Date(date);
  if (isNaN(requestedDate)) throw new ApiError(400, 'Invalid date format');
  if (requestedDate < new Date(new Date().toDateString())) throw new ApiError(400, 'Cannot book slots in the past');

  let branch;
  if (vehicleId) {
    const vehicle = await DemoVehicle.findById(vehicleId).populate('assignedBranch');
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    if (vehicle.status !== 'Available') throw new ApiError(400, `Vehicle is currently ${vehicle.status} and cannot be booked`);
    branch = vehicle.assignedBranch;
  } else if (branchId) {
    branch = await Branch.findById(branchId);
    if (!branch) throw new ApiError(404, 'Branch not found');
  } else {
    throw new ApiError(400, 'Either vehicleId or branchId is required');
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[requestedDate.getDay()];

  const advanceDays = branch.tdSlotDuration || 45;
  const allSlots = generateSlots(branch.tdStartTime, branch.tdEndTime, branch.tdSlotDuration, branch.tdBufferTime);

  // Fetch existing bookings for this vehicle on this date
  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const query = {
    preferredDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['Cancelled', 'No Show'] }
  };
  if (vehicleId) query.assignedVehicle = vehicleId;
  else query.branch = branch._id;

  const existingBookings = await TDBooking.find(query).select('slotStart slotEnd');
  const bookedSlots = new Set(existingBookings.map(b => b.slotStart));

  const slotsWithAvailability = allSlots.map(slot => ({
    ...slot,
    available: !bookedSlots.has(slot.start)
  }));

  res.json({
    success: true,
    data: {
      date,
      branch: { _id: branch._id, name: branch.name, city: branch.city },
      slotDuration: branch.tdSlotDuration,
      slots: slotsWithAvailability
    }
  });
});

// POST /td/slots/check — check if a specific slot is still available before confirming
exports.checkSlot = asyncHandler(async (req, res) => {
  const { vehicleId, date, slotStart } = req.body;
  if (!vehicleId || !date || !slotStart) throw new ApiError(400, 'vehicleId, date, and slotStart are required');

  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const conflict = await TDBooking.findOne({
    assignedVehicle: vehicleId,
    preferredDate: { $gte: startOfDay, $lte: endOfDay },
    slotStart,
    status: { $nin: ['Cancelled', 'No Show'] }
  });

  res.json({ success: true, available: !conflict });
});
