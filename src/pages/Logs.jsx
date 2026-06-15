// src/pages/Logs.jsx
import { useState, useEffect, useCallback } from 'react';
import { fetchLogs, deleteLog } from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import DataTable from '../components/DataTable';
import Filters from '../components/Filters';
import LogImageModal from '../components/LogImageModal';
import { buildLogColumns } from '../components/logColumns';

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  vehicle_number: '',
  event_type: '',
  from: '',
  to: '',
};

export default function Logs() {
  const toast = useToast();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [modalLogId, setModalLogId] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (filters.vehicle_number) params.vehicle_number = filters.vehicle_number;
      if (filters.event_type) params.event_type = filters.event_type;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const { items, total: t } = await fetchLogs(params);
      setLogs(items);
      setTotal(t);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load logs'));
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
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
    setFilters(EMPTY_FILTERS);
  };

  const handleDelete = async (log) => {
    const id = log.id ?? log._id;
    if (!window.confirm(`Delete log for "${log.vehicle_number || 'unknown'}"?`)) {
      return;
    }
    try {
      await deleteLog(id);
      toast.success('Log deleted');
      // If we just deleted the last row on the page, step back a page.
      if (logs.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        loadLogs();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete log'));
    }
  };

  const columns = buildLogColumns({
    onView: (log) => setModalLogId(log.id ?? log._id),
    onDelete: handleDelete,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          License plate recognition events
        </p>
      </div>

      <Filters
        initial={filters}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        rowKey={(row, i) => row.id ?? row._id ?? i}
        emptyMessage="No logs found"
      />

      {/* Pagination */}
      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-gray-500">
          Showing {startIndex}–{endIndex} of {total} results
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <LogImageModal logId={modalLogId} onClose={() => setModalLogId(null)} />
    </div>
  );
}
