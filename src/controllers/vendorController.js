const Vendor = require('../models/Vendor');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');

const DEFAULT_VENDORS = [
  {
    code: 'vinfast',
    name: 'VinFast',
    legalName: 'VinFast Auto India Pvt. Ltd.',
    type: 'OEM',
    paymentTermsDefault: 'Advance',
    contactPerson: 'Procurement Desk',
    email: 'procurement@vinfastauto.in',
    active: true,
    systemProtected: true,
    sortOrder: 1,
    address: {
      line1: 'OEM Supply — VinFast Auto India',
      city: 'India',
      country: 'India',
    },
  },
];

async function ensureDefaultVendors() {
  for (const seed of DEFAULT_VENDORS) {
    await Vendor.findOneAndUpdate(
      { code: seed.code },
      { $setOnInsert: seed },
      { upsert: true, new: true },
    );
  }
}

function slugifyCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function resolveVendorFromBody(body) {
  if (body?.supplierId) {
    const doc = await Vendor.findById(body.supplierId);
    if (!doc || !doc.active) throw new ApiError(400, 'Invalid or inactive vendor');
    return { supplierId: doc._id, supplier: doc.name, vendor: doc };
  }
  const supplierName = String(body?.supplier || 'VinFast').trim();
  if (!supplierName) throw new ApiError(400, 'Vendor is required');
  let doc = await Vendor.findOne({ name: supplierName, active: true });
  if (!doc) doc = await Vendor.findOne({ code: slugifyCode(supplierName), active: true });
  return { supplierId: doc?._id, supplier: supplierName, vendor: doc };
}

exports.ensureDefaultVendors = ensureDefaultVendors;
exports.resolveVendorFromBody = resolveVendorFromBody;

exports.listVendors = asyncHandler(async (req, res) => {
  await ensureDefaultVendors();
  const q = {};
  const includeInactive = String(req.query.includeInactive || '') === '1' || req.query.includeInactive === 'true';
  if (!includeInactive) q.active = true;
  if (req.query.type) q.type = String(req.query.type).toUpperCase();
  const docs = await Vendor.find(q).sort({ sortOrder: 1, name: 1 }).lean();
  return successResponse(res, docs);
});

exports.getVendor = asyncHandler(async (req, res) => {
  const doc = await Vendor.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vendor not found');
  return successResponse(res, doc);
});

exports.createVendor = asyncHandler(async (req, res) => {
  await ensureDefaultVendors();
  const name = String(req.body.name || '').trim();
  if (!name) throw new ApiError(400, 'Vendor name is required');
  const code = slugifyCode(req.body.code || name);
  const exists = await Vendor.findOne({ $or: [{ code }, { name }] });
  if (exists) throw new ApiError(409, 'Vendor with this code or name already exists');
  const maxOrder = await Vendor.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
  const doc = await Vendor.create({
    code,
    name,
    legalName: req.body.legalName,
    type: req.body.type || 'OEM',
    gstin: req.body.gstin,
    pan: req.body.pan,
    address: req.body.address,
    contactPerson: req.body.contactPerson,
    phone: req.body.phone,
    email: req.body.email,
    paymentTermsDefault: req.body.paymentTermsDefault,
    active: req.body.active !== false,
    sortOrder: Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : (maxOrder?.sortOrder ?? 0) + 1,
    logoUrl: req.body.logoUrl,
  });
  return successResponse(res, doc, 'Vendor created', 201);
});

exports.updateVendor = asyncHandler(async (req, res) => {
  const doc = await Vendor.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vendor not found');
  const fields = [
    'name', 'legalName', 'type', 'gstin', 'pan', 'address', 'contactPerson',
    'phone', 'email', 'paymentTermsDefault', 'active', 'sortOrder', 'logoUrl',
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) doc[f] = req.body[f];
  }
  if (req.body.name !== undefined && !String(req.body.name).trim()) {
    throw new ApiError(400, 'Vendor name cannot be empty');
  }
  await doc.save();
  return successResponse(res, doc, 'Vendor updated');
});

exports.deleteVendor = asyncHandler(async (req, res) => {
  const doc = await Vendor.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Vendor not found');
  if (doc.systemProtected) throw new ApiError(400, 'Protected vendors cannot be deleted');
  await doc.deleteOne();
  return successResponse(res, { _id: doc._id }, 'Vendor deleted');
});
