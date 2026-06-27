export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginationMeta(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
