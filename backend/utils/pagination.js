exports.getPagination = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

exports.buildPaginatedResponse = ({ docs, total, page, limit }) => ({
  count: docs.length,
  total,
  pages: Math.ceil(total / limit) || 1,
  currentPage: page,
  data: docs
});
