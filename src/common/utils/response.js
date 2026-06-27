export function success(data, pagination = null) {
  const response = { success: true, data };
  if (pagination) {
    response.pagination = pagination;
  }
  return response;
}

export function error(code, message, details = null) {
  return { success: false, error: { code, message, details } };
}
