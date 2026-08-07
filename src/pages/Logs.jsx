// src/pages/Logs.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchLogs } from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, normalizePagination } from '../utils/format';
import DataTable from '../components/DataTable';
import Filters, { EMPTY_LOG_FILTERS } from '../components/Filters';
import { buildLogColumns } from '../components/logColumns';

// Matches the API's own default. Its ceiling is 200.
const PAGE_SIZE = 25;

/**
 * Turns the filter form into query params, dropping the empty ones so a blank
 * field is absent rather than sent as "" — the API treats an empty value as
 * "not supplied", and this keeps the URL honest about what is being asked.
 */
const toParams = (filters, page) => {
  const params = { page, limit: PAGE_SIZE };
  for (const key of ['group_id', 'search', 'vehicle_type', 'device_name', 'from', 'to']) {
    const value = String(filters[key] ?? '').trim();
    if (value) params[key] = value;
  }
  return params;
};

export default function Logs() {
  const toast = useToast();
  const { projects, isSuperAdmin } = useAuth();

  const [logs, setLogs] = useState([]);
  const [pageInfo, setPageInfo] = useState(
    normalizePagination(null, { page: 1, limit: PAGE_SIZE, total: 0 })
  );
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_LOG_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Only the newest request may write state. Without this, changing a filter
  // while a slower request is in flight can let stale rows land on top.
  const requestSeq = useRef(0);

  const loadLogs = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const { items, total, pagination } = await fetchLogs(toParams(filters, page));
      if (seq !== requestSeq.current) return;
      setLogs(items);
      setPageInfo(normalizePagination(pagination, { page, limit: PAGE_SIZE, total }));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const status = err?.response?.status;
      const message =
        status === 403
          ? "You don't have access to that project."
          : getErrorMessage(err, 'Failed to load logs');
      setError(message);
      toast.error(message);
      setLogs([]);
      setPageInfo(normalizePagination(null, { page, limit: PAGE_SIZE, total: 0 }));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, filters, toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearch = (newFilters) => {
    setPage(1);
    setFilters(newFilters);
  };

  const handleClear = () => {
    setPage(1);
    setFilters(EMPTY_LOG_FILTERS);
  };

  // The project column only earns its place when rows can differ: more than one
  // project in view and no single one selected.
  const showProject =
    !filters.group_id && (isSuperAdmin || (projects?.length ?? 0) > 1);

  const columns = useMemo(() => buildLogColumns({ showProject }), [showProject]);

  const { total, totalPages, hasNext, hasPrevious } = pageInfo;
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vehicle detections from your projects, newest first
        </p>
      </div>

      <Filters
        initial={filters}
        projects={projects}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        rowKey={(row, i) => row.id ?? i}
        emptyMessage="No detections match these filters"
      />

      {/* Pagination — has_next / has_previous come from the server. */}
      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-gray-500">
          {total === 0
            ? 'No results'
            : `Showing ${startIndex}–${endIndex} of ${total} detection${total === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasPrevious || loading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext || loading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
