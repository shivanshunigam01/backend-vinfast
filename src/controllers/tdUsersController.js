require('../models/tdModels');

const TDStaff = require('../models/TDStaff');
const { STAFF_DESIGNATIONS } = require('../models/TDStaff');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { DESIGNATION_LABELS } = require('../utils/tdBookingFormatter');
const { ensureTdStaff } = require('../utils/tdBootstrap');

function formatStaff(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: plain._id,
    name: plain.name,
    email: plain.email,
    role: plain.role,
    designation: plain.designation,
    designationLabel: DESIGNATION_LABELS[plain.designation] || plain.designation,
    reportsTo: plain.reportsTo || null,
    active: Boolean(plain.active),
    createdAt: plain.createdAt,
  };
}

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const query = {};
  if (req.query.designation && req.query.designation !== 'all') {
    query.designation = String(req.query.designation).trim();
  }

  let [docs, total] = await Promise.all([
    TDStaff.find(query).sort({ designation: 1, name: 1 }).skip(skip).limit(limit),
    TDStaff.countDocuments(query),
  ]);

  if (
    total === 0 &&
    page === 1 &&
    (!req.query.designation || req.query.designation === 'all')
  ) {
    await ensureTdStaff();
    [docs, total] = await Promise.all([
      TDStaff.find(query).sort({ designation: 1, name: 1 }).skip(skip).limit(limit),
      TDStaff.countDocuments(query),
    ]);
  }

  return successResponse(res, docs.map(formatStaff), undefined, 200, { page, limit, total });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, designation, active } = req.body || {};
  if (!name || !email) throw new ApiError(400, 'Name and email are required');
  if (!password || String(password).length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }
  if (designation && !STAFF_DESIGNATIONS.includes(designation)) {
    throw new ApiError(400, 'Invalid designation');
  }

  const exists = await TDStaff.findOne({ email: String(email).trim().toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already registered');

  const doc = await TDStaff.create({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    password: String(password),
    designation: designation || 'sales_executive',
    role: designation === 'sales_executive' ? 'executive' : 'manager',
    active: active !== false,
  });

  return successResponse(res, formatStaff(doc), 'User created', 201);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const doc = await TDStaff.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'User not found');

  const { name, email, password, designation, active } = req.body || {};
  if (name !== undefined) doc.name = String(name).trim();
  if (email !== undefined) doc.email = String(email).trim().toLowerCase();
  if (password) doc.password = String(password);
  if (designation !== undefined) {
    if (!STAFF_DESIGNATIONS.includes(designation)) throw new ApiError(400, 'Invalid designation');
    doc.designation = designation;
    doc.role = designation === 'sales_executive' ? 'executive' : 'manager';
  }
  if (active !== undefined) doc.active = Boolean(active);

  await doc.save();
  return successResponse(res, formatStaff(doc), 'User updated');
});

exports.patchUser = asyncHandler(async (req, res) => {
  const doc = await TDStaff.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'User not found');
  if (req.body?.active !== undefined) doc.active = Boolean(req.body.active);
  await doc.save();
  return successResponse(res, formatStaff(doc), 'User updated');
});

async function listAssignableStaff() {
  const docs = await TDStaff.find({
    designation: { $in: STAFF_DESIGNATIONS },
    active: true,
  })
    .select('name email role designation reportsTo active')
    .sort({ designation: 1, name: 1 })
    .lean();

  return docs.map((row) => ({
    ...row,
    designationLabel: DESIGNATION_LABELS[row.designation] || row.designation,
  }));
}

exports.listAssignable = asyncHandler(async (req, res) => {
  const data = await listAssignableStaff();
  return successResponse(res, data);
});

exports.listAssignableStaff = listAssignableStaff;
