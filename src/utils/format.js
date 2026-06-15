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
 * This normalizes the common shapes into { items, total }.
 */
export const normalizeListResponse = (data) => {
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  const items =
    data?.data ??
    data?.logs ??
    data?.results ??
    data?.items ??
    data?.vehicles ??
    data?.cameras ??
    [];
  const total =
    data?.total ??
    data?.count ??
    data?.totalCount ??
    (Array.isArray(items) ? items.length : 0);
  return { items: Array.isArray(items) ? items : [], total };
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
