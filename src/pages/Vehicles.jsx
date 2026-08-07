// src/pages/Vehicles.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  setVehicleStatus,
  deleteVehicle,
} from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  getErrorMessage,
  formatDate,
  formatDateTime,
  normalizePagination,
} from '../utils/format';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import VehicleFormModal from '../components/VehicleFormModal';
import Switch from '../components/Switch';
import { TrashIcon } from '../components/icons';

const PAGE_SIZE = 25;

const EMPTY_FILTERS = {
  group_id: '',
  search: '',
  status: '',
  is_active: '',
};

/**
 * Status is two independent things folded into one word, so the badge says which
 * one is talking: a pass can be switched off by a person (deactivated) or simply
 * run out (expired). One ambiguous "unregistered" pill would hide the difference
 * that determines what you do about it.
 */
function StatusCell({ row }) {
  if (row.status === 'registered') return <Badge color="blue">registered</Badge>;
  if (row.inactive_reason === 'deactivated')
    return <Badge color="yellow">deactivated</Badge>;
  return <Badge color="gray">expired</Badge>;
}

/**
 * How much life is left in the pass. days_remaining is signed — negative once
 * expired — and is reported even while deactivated, because valid_till keeps
 * running down while a vehicle is suspended.
 */
function ValidityCell({ row }) {
  const days = row.days_remaining;
  const expired = typeof days === 'number' && days < 0;

  return (
    <span className="whitespace-nowrap">
      <span className={expired ? 'text-gray-400 line-through' : ''}>
        {formatDate(row.valid_till)}
      </span>
      {typeof days === 'number' && (
        <span
          className={`ml-2 text-xs ${
            expired ? 'text-gray-400' : days <= 14 ? 'text-amber-600' : 'text-gray-400'
          }`}
        >
          {expired
            ? `expired ${Math.abs(days)}d ago`
            : days === 0
              ? 'today'
              : `${days}d left`}
        </span>
      )}
    </span>
  );
}

export default function Vehicles() {
  const toast = useToast();
  const { projects, isSuperAdmin, hasPermission } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [page, setPage] = useState(1);
  // `draft` is what the filter bar shows; `filters` is what has been asked for.
  // Keeping them apart is what stops every keystroke becoming a request.
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [pageInfo, setPageInfo] = useState(
    normalizePagination(null, { page: 1, limit: PAGE_SIZE, total: 0 })
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, vehicle: null });
  const [busyId, setBusyId] = useState(null);

  const requestSeq = useRef(0);

  const updateDraft = (key, value) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const loadVehicles = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      // Blank means "no opinion" and is left off entirely; is_active is a real
      // boolean, so it survives the emptiness check as a string first.
      if (filters.group_id) params.group_id = filters.group_id;
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status) params.status = filters.status;
      if (filters.is_active !== '') params.is_active = filters.is_active === 'true';

      const { items, total, pagination } = await fetchVehicles(params);
      if (seq !== requestSeq.current) return;
      setVehicles(items);
      setPageInfo(normalizePagination(pagination, { page, limit: PAGE_SIZE, total }));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const message = getErrorMessage(err, 'Failed to load vehicles');
      setError(message);
      toast.error(message);
      setVehicles([]);
      setPageInfo(normalizePagination(null, { page, limit: PAGE_SIZE, total: 0 }));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, filters, toast]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  /** Swaps one row in place — no refetch, since the API returns the new record. */
  const replaceRow = (updated) =>
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

  // The modal rethrows on failure so it can show field-level errors; these only
  // handle the success path.
  const handleCreate = async (payload) => {
    const { created } = await createVehicle(payload);
    toast.success(
      created
        ? `${payload.vehicle_number} registered`
        : `${payload.vehicle_number} registration renewed`
    );
    setModal({ open: false, vehicle: null });
    if (page === 1) loadVehicles();
    else setPage(1);
  };

  const handleUpdate = async (payload) => {
    const updated = await updateVehicle(modal.vehicle.id, payload);
    toast.success(`${modal.vehicle.vehicle_number} updated`);
    setModal({ open: false, vehicle: null });
    if (updated?.id) replaceRow(updated);
    else loadVehicles();
  };

  const handleToggleStatus = async (row) => {
    const next = !row.is_active;
    setBusyId(row.id);
    try {
      const updated = await setVehicleStatus(row.id, next);
      if (updated?.id) replaceRow(updated);
      else loadVehicles();
      toast.success(
        next
          ? `${row.vehicle_number} activated — registered again from the next detection`
          : `${row.vehicle_number} deactivated — reads as unregistered at every gate`
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to change status'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row) => {
    if (
      !window.confirm(
        `Delete the registration for ${row.vehicle_number}?\n\nDetections already logged are kept — they record the status judged at the time.`
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      await deleteVehicle(row.id);
      toast.success(`${row.vehicle_number} registration deleted`);
      // Refetch rather than splice: the page is now one row short and the row
      // that fills it comes from the server.
      loadVehicles();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete vehicle'));
    } finally {
      setBusyId(null);
    }
  };

  // A super admin's scope is "every project", which the server cannot collapse
  // to a single default — so they must always name one, even with one project.
  const requireProject = isSuperAdmin || (projects?.length ?? 0) > 1;
  const canWrite = hasPermission('vehicle:write');

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'vehicle_number',
        header: 'Vehicle number',
        render: (row) => (
          <span className="font-mono font-medium text-gray-900">
            {row.vehicle_number}
          </span>
        ),
      },
      { key: 'name', header: 'Owner', render: (row) => row.name || '—' },
      {
        key: 'vehicle_model',
        header: 'Model',
        // Free text and optional — nothing branches on it, it is there so an
        // operator can recognise the vehicle.
        render: (row) =>
          row.vehicle_model || <span className="text-gray-400">—</span>,
      },
      {
        key: 'phone_number',
        header: 'Phone',
        render: (row) => (
          <span className="whitespace-nowrap">{row.phone_number || '—'}</span>
        ),
      },
      { key: 'status', header: 'Status', render: (row) => <StatusCell row={row} /> },
      {
        key: 'is_active',
        header: 'Active',
        // The switch sits next to Status rather than among the actions, because
        // it is the state itself, not something done to the row. Status shows
        // the outcome (which also depends on the expiry date); this shows the
        // one half a person controls.
        render: (row) =>
          canWrite ? (
            <Switch
              checked={row.is_active}
              disabled={busyId === row.id}
              onChange={() => handleToggleStatus(row)}
              labels={null}
              title={
                row.is_active
                  ? `Switch off ${row.vehicle_number} — it reads as unregistered at every gate from the next detection`
                  : `Switch on ${row.vehicle_number}${
                      row.days_remaining < 0
                        ? ' — note its pass has expired, so it stays unregistered until the expiry is extended'
                        : ' — registered again from the next detection'
                    }`
              }
            />
          ) : (
            <Switch
              checked={row.is_active}
              disabled
              labels={null}
              title={row.is_active ? 'Active' : 'Inactive'}
            />
          ),
      },
      {
        key: 'valid_till',
        header: 'Valid till',
        render: (row) => <ValidityCell row={row} />,
      },
      {
        key: 'device_names',
        header: 'Gates',
        // Empty means every gate in the project, which is the normal case.
        render: (row) =>
          row.device_names?.length ? (
            <span className="font-mono text-xs">{row.device_names.join(', ')}</span>
          ) : (
            <span className="text-gray-400">All gates</span>
          ),
      },
      {
        key: 'registered_by',
        header: 'Added by',
        render: (row) => (
          <span
            className="whitespace-nowrap"
            title={
              row.updated_by?.name ? `Last edited by ${row.updated_by.name}` : undefined
            }
          >
            {row.registered_by?.name || <span className="text-gray-400">—</span>}
          </span>
        ),
      },
      {
        key: 'created_at',
        header: 'Added',
        render: (row) => (
          <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span>
        ),
      },
    ];

    if (requireProject) {
      cols.unshift({
        key: 'group_id',
        header: 'Project',
        render: (row) => (
          <span className="font-mono text-xs text-gray-600">{row.group_id}</span>
        ),
      });
    }

    if (canWrite) {
      cols.push({
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <button
              onClick={() => setModal({ open: true, vehicle: row })}
              disabled={busyId === row.id}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(row)}
              disabled={busyId === row.id}
              className="rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              title="Delete registration"
              aria-label="Delete registration"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ),
      });
    }

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireProject, canWrite, busyId]);

  const { total, totalPages, hasNext, hasPrevious } = pageInfo;
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, total);

  const inputClass =
    'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="mt-1 text-sm text-gray-500">
            A plate reads as registered at the gate only while its pass is in date
            and it has not been deactivated
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setModal({ open: true, vehicle: null })}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Add vehicle
          </button>
        )}
      </div>

      {/* Filters. Applied on submit rather than per keystroke, so typing a plate
          is one request instead of one per character. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setFilters(draft);
        }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        {requireProject && (
          <label className="flex flex-col">
            <span className="mb-1 text-xs font-medium text-gray-500">Project</span>
            <select
              value={draft.group_id}
              onChange={(e) => updateDraft('group_id', e.target.value)}
              className={inputClass}
            >
              <option value="">All my projects</option>
              {projects.map((p) => (
                <option key={p.group_id} value={p.group_id}>
                  {p.project_name || p.group_id}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Search</span>
          <input
            type="text"
            value={draft.search}
            onChange={(e) => updateDraft('search', e.target.value)}
            placeholder="Plate, owner, phone or model"
            maxLength={100}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Status</span>
          <select
            value={draft.status}
            onChange={(e) => updateDraft('status', e.target.value)}
            className={inputClass}
          >
            <option value="">Any</option>
            <option value="registered">Registered</option>
            <option value="unregistered">Unregistered</option>
          </select>
        </label>

        {/* Distinct from status, which folds expiry in: this is the manual
            switch on its own, so "suspended" and "merely lapsed" are separable. */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Switch</span>
          <select
            value={draft.is_active}
            onChange={(e) => updateDraft('is_active', e.target.value)}
            className={inputClass}
          >
            <option value="">Any</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select>
        </label>

        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setDraft(EMPTY_FILTERS);
            setFilters(EMPTY_FILTERS);
          }}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Clear
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={vehicles}
        loading={loading}
        rowKey={(row, i) => row.id ?? i}
        emptyMessage="No vehicles match these filters"
      />

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-gray-500">
          {total === 0
            ? 'No results'
            : `Showing ${startIndex}–${endIndex} of ${total} vehicle${total === 1 ? '' : 's'}`}
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

      <VehicleFormModal
        open={modal.open}
        vehicle={modal.vehicle}
        onClose={() => setModal({ open: false, vehicle: null })}
        projects={projects}
        requireProject={requireProject}
        onSubmit={modal.vehicle ? handleUpdate : handleCreate}
      />
    </div>
  );
}
