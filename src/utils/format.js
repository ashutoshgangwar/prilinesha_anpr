// src/utils/format.js
import { format, parseISO, isValid } from 'date-fns';

/**
 * Formats a datetime string/Date into "DD MMM YYYY, HH:mm:ss".
 * Returns "—" when the value is missing or unparseable.
 */
export const formatDateTime = (value) => {
  if (!value) return '—';
  let date = value instanceof Date ? value : null;
  if (!date) {
    // Try ISO first, then fall back to the Date constructor.
    date = parseISO(String(value));
    if (!isValid(date)) date = new Date(value);
  }
  if (!isValid(date)) return String(value);
  return format(date, 'dd MMM yyyy, HH:mm:ss');
};

/** Formats a date as "DD MMM YYYY". */
export const formatDate = (value) => {
  if (!value) return '—';
  let date = value instanceof Date ? value : parseISO(String(value));
  if (!isValid(date)) date = new Date(value);
  if (!isValid(date)) return String(value);
  return format(date, 'dd MMM yyyy');
};

/**
 * The backend may return paginated lists under different keys.
 * This normalizes the common shapes into { items, total, pagination }.
 *
 * `count` is deliberately NOT treated as a total: on /api/logs it is the number
 * of rows in THIS page, so using it would report "25 results" on every page of
 * a thousand. The real figure is pagination.total.
 */
export const normalizeListResponse = (data) => {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, pagination: null };
  }

  const items =
    data?.data ??
    data?.logs ??
    data?.results ??
    data?.items ??
    data?.vehicles ??
    data?.cameras ??
    [];
  const list = Array.isArray(items) ? items : [];

  const pagination = data?.pagination ?? null;
  const total =
    pagination?.total ??
    data?.total ??
    data?.totalCount ??
    list.length;

  return { items: list, total, pagination };
};

/**
 * Page-level view of a list response, filling in what the backend didn't send.
 * Prefers the server's own has_next / total_pages over anything recomputed
 * locally, so the two can never disagree.
 */
export const normalizePagination = (pagination, { page, limit, total }) => {
  const p = pagination || {};
  const currentPage = p.page ?? page ?? 1;
  const perPage = p.limit ?? limit ?? 25;
  // Clamped to at least 1: the API reports total_pages: 0 for an empty result,
  // which would otherwise render as "Page 1 of 0".
  const totalPages = Math.max(
    1,
    p.total_pages ?? Math.ceil((total || 0) / perPage)
  );
  return {
    page: currentPage,
    limit: perPage,
    total: p.total ?? total ?? 0,
    totalPages,
    hasNext: p.has_next ?? currentPage < totalPages,
    hasPrevious: p.has_previous ?? currentPage > 1,
  };
};

/** Extracts a human-readable message from an axios error. */
export const getErrorMessage = (error, fallback = 'Something went wrong') => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};
