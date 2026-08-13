// src/pages/Vehicles.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchVehicles,
  fetchVehicleFilters,
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
  device_name: '',
  registered_by: '',
  valid_from: '',
  valid_to: '',
  expiring_in_days: '',
};

/**
 * The status chips, and the exact query each one opens.
 *
 * These are not decoration: every chip's filter set is chosen to match the
 * count the API reports for it, so the number on the chip is the number of rows
 * you get. `expired` and `deactivated` are the two halves of `unregistered` —
 * kept apart because one is fixed by renewing and the other by switching back
 * on. `is_active=true` is what isolates the merely-lapsed from the suspended.
 */
const CHIPS = [
  { key: 'total', label: 'All', filters: {} },
  { key: 'registered', label: 'Registered', filters: { status: 'registered' } },
  {
    key: 'expired',
    label: 'Expired',
    filters: { status: 'unregistered', is_active: 'true' },
  },
  { key: 'deactivated', label: 'Deactivated', filters: { is_active: 'false' } },
];

/** Which chip, if any, the current filters represent. */
const chipMatches = (chip, filters, expiringDays) => {
  if (chip.key === 'expiring') {
    return String(filters.expiring_in_days) === String(expiringDays);
  }
  if (filters.expiring_in_days) return false;
  const want = chip.filters;
  return (
    (want.status ?? '') === filters.status &&
    (want.is_active ?? '') === filters.is_active
  );
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
  // Projects, gates, operators and the count behind each chip. Reloaded after
  // every write, since registering or deactivating a vehicle moves the counts.
  const [options, setOptions] = useState(null);

  // The API owns the renewal horizon; 30 is only the stand-in until it answers.
  const expiringDays = options?.expiring_soon?.within_days ?? 30;

  const requestSeq = useRef(0);

  const loadOptions = useCallback(() => {
    fetchVehicleFilters()
      .then(setOptions)
      .catch(() => {
        /* An enhancement — the table and its filters work without it. */
      });
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const updateDraft = (key, value) =>
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // Switching project can strand a gate belonging to the old one, which
      // would then quietly match nothing.
      if (key === 'group_id') next.device_name = '';
      return next;
    });

  /**
   * Chips bypass the draft: they are a whole query, applied on click, so they
   * replace the pending form rather than merging into it — otherwise a
   * half-typed search would silently ride along with the count you clicked.
   */
  const applyChip = (chip) => {
    const next = {
      ...EMPTY_FILTERS,
      group_id: filters.group_id,
      ...(chip.key === 'expiring'
        ? { expiring_in_days: String(expiringDays) }
        : chip.filters),
    };
    setPage(1);
    setDraft(next);
    setFilters(next);
  };

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
      if (filters.device_name) params.device_name = filters.device_name;
      if (filters.registered_by) params.registered_by = filters.registered_by;
      if (filters.valid_from) params.valid_from = filters.valid_from;
      if (filters.valid_to) params.valid_to = filters.valid_to;
      if (filters.expiring_in_days !== '')
        params.expiring_in_days = Number(filters.expiring_in_days);

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
    loadOptions(); // a new registration moves the counts
    if (page === 1) loadVehicles();
    else setPage(1);
  };

  const handleUpdate = async (payload) => {
    const updated = await updateVehicle(modal.vehicle.id, payload);
    toast.success(`${modal.vehicle.vehicle_number} updated`);
    setModal({ open: false, vehicle: null });
    // An edit can extend valid_till, which moves a row between chips.
    loadOptions();
    if (updated?.id) replaceRow(updated);
    else loadVehicles();
  };

  const handleToggleStatus = async (row) => {
    const next = !row.is_active;
    setBusyId(row.id);
    try {
      const updated = await setVehicleStatus(row.id, next);
      loadOptions(); // moves the row between the registered/deactivated chips
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
      loadOptions();
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

  const counts = options?.counts ?? null;
  const operators = options?.registered_by ?? [];
  // Prefer the filter payload's project list: it is scoped exactly like the
  // table, so it can never offer a project the request would 403 on.
  const filterProjects = options?.projects ?? projects ?? [];
  // Gates belong to a project, so naming one narrows the list to its own.
  const selectedProject = filterProjects.find((p) => p.group_id === draft.group_id);
  const gates = selectedProject
    ? selectedProject.device_names ?? []
    : options?.device_names ?? [];

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

      {/* Status chips. Each number comes from GET /api/vehicles/filters and the
          chip opens exactly the rows it counts, so the two can never disagree. */}
      {counts && (
        <div className="mb-4 flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            const active = chipMatches(chip, filters, expiringDays);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => applyChip(chip)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {chip.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {counts[chip.key] ?? 0}
                </span>
              </button>
            );
          })}

          {/* The renewals queue — switched on and lapsing soon. Not part of the
              partition above: these rows are still registered today. */}
          {options?.expiring_soon && (
            <button
              type="button"
              onClick={() => applyChip({ key: 'expiring' })}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                chipMatches({ key: 'expiring' }, filters, expiringDays)
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
              title={`Registrations lapsing within ${expiringDays} days`}
            >
              Expiring in {expiringDays}d
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  chipMatches({ key: 'expiring' }, filters, expiringDays)
                    ? 'bg-white/20'
                    : 'bg-amber-200/70'
                }`}
              >
                {options.expiring_soon.count ?? 0}
              </span>
            </button>
          )}
        </div>
      )}

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
              {filterProjects.map((p) => (
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

        {/* "Who may come through this gate?" — the question a guard on one
            entrance asks. Registrations with no gates listed are the wildcard
            meaning every gate, and the API counts them here too. */}
        {gates.length > 0 && (
          <label className="flex flex-col">
            <span className="mb-1 text-xs font-medium text-gray-500">Gate</span>
            <select
              value={draft.device_name}
              onChange={(e) => updateDraft('device_name', e.target.value)}
              className={inputClass}
            >
              <option value="">Any gate</option>
              {gates.map((gate) => (
                <option key={gate} value={gate}>
                  {gate}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Only the operators who have actually registered something in scope,
            so this is the handful of names in the table, not every account. */}
        {operators.length > 0 && (
          <label className="flex flex-col">
            <span className="mb-1 text-xs font-medium text-gray-500">Added by</span>
            <select
              value={draft.registered_by}
              onChange={(e) => updateDraft('registered_by', e.target.value)}
              className={inputClass}
            >
              <option value="">Anyone</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name || op.email || op.id}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* A window on the expiry date itself — "which passes run out this
            month?" — independent of status, which only asks whether that date
            has already passed. */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">
            Expires from
          </span>
          <input
            type="date"
            value={draft.valid_from}
            onChange={(e) => updateDraft('valid_from', e.target.value)}
            max={draft.valid_to || undefined}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Expires to</span>
          <input
            type="date"
            value={draft.valid_to}
            onChange={(e) => updateDraft('valid_to', e.target.value)}
            min={draft.valid_from || undefined}
            className={inputClass}
          />
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
