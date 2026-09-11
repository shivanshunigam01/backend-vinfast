const { dateKeyRange } = require('./reportPeriod');

exports.buildPagination = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

exports.buildDateRange = (from, to) => {
  if (!from && !to) return undefined;
  const range = dateKeyRange(from, to);
  return Object.keys(range).length ? range : undefined;
};

exports.buildSearchQuery = (search, fields = []) => {
  if (!search) return undefined;
  return {
    $or: fields.map((field) => ({ [field]: { $regex: search, $options: 'i' } })),
  };
};
