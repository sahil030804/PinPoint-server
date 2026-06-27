export function paginationMiddleware(req, _res, next) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;

  req.pagination = { page, limit, offset };
  next();
}
