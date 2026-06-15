require('../models/tdModels');

const TDBranch = require('../models/TDBranch');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

exports.listPublicBranches = asyncHandler(async (req, res) => {
  let docs = await TDBranch.find({ active: { $ne: false } }).sort({ name: 1 });
  if (docs.length === 0) {
    docs = [
      await TDBranch.create({
        name: 'Patna Showroom',
        code: 'PATNA',
        city: 'Patna',
        phone: '+91 9231445060',
        active: true,
      }),
    ];
  }
  const data = docs.map((b) => ({
    _id: b._id,
    name: b.name,
    code: b.code,
    city: b.city,
    phone: b.phone,
  }));
  return successResponse(res, data);
});
