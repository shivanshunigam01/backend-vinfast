const PVCustomer = require('../models/PVCustomer');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { isCrmStaffRole } = require('../constants/leadStages');
const {
  buildCustomerHistory,
  findCustomerByMobile,
  normalizeMobile,
} = require('../utils/customerHistoryBuilder');

function assertCrmAccess(admin) {
  if (!isCrmStaffRole(admin.role)) {
    throw new ApiError(403, 'Customer history access is for CRM staff only');
  }
}

/** Customer master list with search (name / mobile / customer ID). */
exports.listCustomers = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { page, limit, skip } = buildPagination(req);

  const query = { isSubCustomer: { $ne: true } };
  if (req.query.search) {
    const regex = new RegExp(String(req.query.search).trim(), 'i');
    query.$or = [{ name: regex }, { mobile: regex }, { customerId: regex }, { email: regex }];
  }

  const [docs, total] = await Promise.all([
    PVCustomer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PVCustomer.countDocuments(query),
  ]);

  return successResponse(res, docs, undefined, 200, { page, limit, total });
});

/**
 * Existing-customer lookup by mobile. Used by the CRM to show the history
 * popup when a known customer books again or refers someone.
 * GET /crm/customers/lookup?mobile=9876543210[&full=true]
 */
exports.lookupCustomerByMobile = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const mobile = normalizeMobile(req.query.mobile);
  if (!mobile || mobile.length !== 10) {
    throw new ApiError(400, 'A valid 10-digit mobile number is required');
  }

  const customer = await findCustomerByMobile(mobile);
  if (!customer) {
    return successResponse(res, { existingCustomer: false, customer: null, history: null });
  }

  const history = await buildCustomerHistory(customer);
  return successResponse(res, { existingCustomer: true, ...history });
});

/** Full lifecycle history for one customer (by PVCustomer _id or PVCUST code). */
exports.getCustomerHistory = asyncHandler(async (req, res) => {
  assertCrmAccess(req.admin);
  const { id } = req.params;

  let customer = null;
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    customer = await PVCustomer.findById(id);
  }
  if (!customer) {
    customer = await PVCustomer.findOne({ customerId: id });
  }
  if (!customer) throw new ApiError(404, 'Customer not found');

  const history = await buildCustomerHistory(customer);
  return successResponse(res, history);
});
