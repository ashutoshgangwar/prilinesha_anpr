// src/pages/Visitors.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchVisitors,
  fetchVisitorFilters,
  createVisitor,
  updateVisitor,
  setVisitorStatus,
  deleteVisitor,
} from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  getErrorMessage,
  formatDateTime,
  normalizePagination,
} from '../utils/format';
import DataTable from '../components/DataTable';
import { ChipsSkeleton } from '../components/Skeletons';
import Badge from '../components/Badge';
import Switch from '../components/Switch';
import VisitorFormModal from '../components/VisitorFormModal';
import { TrashIcon } from '../components/icons';

const PAGE_SIZE = 25;

const EMPTY_FILTERS = {
  group_id: '',
  search: '',
  status: '',
  is_active: '',
  on_site: '',
  issued_by: '',
  device_name: '',
  from: '',
  to: '',
};

/**
 * The chips, and the exact query each one opens.
 *
 * The four states partition the collection — on_site + upcoming + expired +
 * revoked = total — so the number on a chip is the number of rows it returns.
 * They are separated because they are four different situations: a pass that has
 * not started is fine and simply early, an expired one did its job, and a revoked
 * one was taken away by a person.
 *
 * `upcoming` and `expired` are both "unregistered and still switched on"; what
 * tells them apart is which side of the window today is on, which is what the
 * from/to bounds below express.
 */
const CHIPS = [
  { key: 'total', label: 'All', filters: {} },
  { key: 'on_site', label: 'On site now', filters: { on_site: 'true' } },
  { key: 'upcoming', label: 'Upcoming', filters: { status: 'unregistered', is_active: 'true', when: 'upcoming' } },
  { key: 'expired', label: 'Expired', filters: { status: 'unregistered', is_active: 'true', when: 'expired' } },
  { key: 'revoked', label: 'Revoked', filters: { is_active: 'false' } },
];

/**
 * Why a pass is not live, said in the word that names the fix: an upcoming pass
 * needs nothing, an expired one needs extending, a revoked one needs
 * reinstating. One ambiguous "unregistered" pill would hide that difference.
 */
function StatusCell({ row }) {
  if (row.status === 'registered') return <Badge color="green">on site</Badge>;
  if (row.inactive_reason === 'revoked') return <Badge color="red">revoked</Badge>;
  if (row.inactive_reason === 'not_started') return <Badge color="blue">upcoming</Badge>;
  return <Badge color="gray">expired</Badge>;
}

/** "3h 20m", "45m" — the shape a visitor window actually has. */
const humanMinutes = (minutes) => {
  const total = Math.abs(Math.round(minutes));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 48) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

/**
 * The window, and how much of it is left.
 *
 * minutes_remaining is signed and reported in minutes rather than days, because
 * a pass is usually an afternoon and a day countdown would read "0" for its
 * entire useful life. It is null before the pass starts, where time remaining is
 * not yet a meaningful number.
 */
function WindowCell({ row }) {
  const remaining = row.minutes_remaining;
  const past = typeof remaining === 'number' && remaining < 0;
  const revoked = row.inactive_reason === 'revoked';

  // A revoked pass keeps its window — valid_till goes on running down — but
  // saying "3h left" about one is a lie: it stopped working the moment it was
  // revoked. The window is still shown, because reinstating it gives back
  // exactly what is left of it.
  const note = revoked
    ? past
      ? 'revoked · window already closed'
      : `revoked · window ends in ${humanMinutes(remaining)}`
    : row.inactive_reason === 'not_started'
      ? `starts later · ${humanMinutes(row.window_minutes)} pass`
      : past
        ? `expired ${humanMinutes(remaining)} ago`
        : `${humanMinutes(remaining)} left`;

  return (
    <div className="whitespace-nowrap text-xs">
      <p className={past || revoked ? 'text-gray-400' : 'text-gray-900'}>
        {formatDateTime(row.valid_from)}
      </p>
      <p className={past ? 'text-gray-400 line-through' : 'text-gray-900'}>
        <span className="mr-1 text-gray-300">→</span>
        {formatDateTime(row.valid_till)}
      </p>
      <p className="mt-0.5 text-gray-400">{note}</p>
    </div>
  );
}

export default function Visitors() {
  const toast = useToast();
  const { projects, isSuperAdmin, hasPermission } = useAuth();

  const [visitors, setVisitors] = useState([]);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [pageInfo, setPageInfo] = useState(
    normalizePagination(null, { page: 1, limit: PAGE_SIZE, total: 0 })
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, visitor: null });
  const [busyId, setBusyId] = useState(null);
  const [options, setOptions] = useState(null);
  // Which chip was clicked. `upcoming` and `expired` share a filter set and
  // differ only by a date bound, so the active chip cannot be read back off the
  // filters alone.
  const [activeChip, setActiveChip] = useState('total');

  const requestSeq = useRef(0);

  const loadOptions = useCallback(() => {
    fetchVisitorFilters()
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
      // A gate belongs to one project, so switching project strands it.
      if (key === 'group_id') next.device_name = '';
      return next;
    });

  /**
   * Chips replace the pending form rather than merging into it, so a half-typed
   * search never rides along with the count you clicked.
   */
  const applyChip = (chip) => {
    const now = new Date().toISOString();
    const { when, ...rest } = chip.filters;

    const next = {
      ...EMPTY_FILTERS,
      group_id: filters.group_id,
      ...rest,
      // The window bound is what separates "hasn't started" from "ran out",
      // since both are unregistered-but-switched-on. from/to are an overlap
      // test: from=now keeps passes still to come, to=now keeps those already
      // over.
      ...(when === 'upcoming' ? { from: now } : {}),
      ...(when === 'expired' ? { to: now } : {}),
    };

    setPage(1);
    setActiveChip(chip.key);
    setDraft(next);
    setFilters(next);
  };

  const loadVisitors = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (filters.group_id) params.group_id = filters.group_id;
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status) params.status = filters.status;
      if (filters.is_active !== '') params.is_active = filters.is_active === 'true';
      if (filters.on_site !== '') params.on_site = filters.on_site === 'true';
      if (filters.issued_by) params.issued_by = filters.issued_by;
      if (filters.device_name) params.device_name = filters.device_name;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const { items, total, pagination } = await fetchVisitors(params);
      if (seq !== requestSeq.current) return;
      setVisitors(items);
      setPageInfo(normalizePagination(pagination, { page, limit: PAGE_SIZE, total }));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const status = err?.response?.status;
      const message =
        status === 403
          ? "You don't have access to that project."
          : getErrorMessage(err, 'Failed to load visitor passes');
      setError(message);
      toast.error(message);
      setVisitors([]);
      setPageInfo(normalizePagination(null, { page, limit: PAGE_SIZE, total: 0 }));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, filters, toast]);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  const replaceRow = (updated) =>
    setVisitors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

  // The modal rethrows on failure so it can show field-level errors; these only
  // handle the success path.
  const handleCreate = async (payload) => {
    const created = await createVisitor(payload);
    toast.success(`Pass issued for ${created?.vehicle_number ?? payload.vehicle_number}`);
    setModal({ open: false, visitor: null });
    loadOptions(); // a new pass moves the counts
    if (page === 1) loadVisitors();
    else setPage(1);
  };

  const handleUpdate = async (payload) => {
    const updated = await updateVisitor(modal.visitor.id, payload);
    toast.success(`${modal.visitor.vehicle_number} pass updated`);
    setModal({ open: false, visitor: null });
    // An edit can extend the window, which moves a row between chips.
    loadOptions();
    if (updated?.id) replaceRow(updated);
    else loadVisitors();
  };

  const handleToggleStatus = async (row) => {
    const next = !row.is_active;
    setBusyId(row.id);
    try {
      const updated = await setVisitorStatus(row.id, next);
      loadOptions();
      if (updated?.id) replaceRow(updated);
      else loadVisitors();
      toast.success(
        next
          ? `${row.vehicle_number} reinstated for whatever is left of its window`
          : `${row.vehicle_number} revoked — reads as unregistered at every gate`
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to change the pass'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row) => {
    if (
      !window.confirm(
        `Delete the pass for ${row.vehicle_number}?\n\nRevoking is usually better: a deleted pass takes with it who was admitted, by whom, and on whose invitation. Detections already logged are kept either way.`
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      await deleteVisitor(row.id);
      toast.success(`${row.vehicle_number} pass deleted`);
      loadOptions();
      loadVisitors();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete the pass'));
    } finally {
      setBusyId(null);
    }
  };

  const requireProject = isSuperAdmin || (projects?.length ?? 0) > 1;
  const canWrite = hasPermission('visitor:write');

  const counts = options?.counts ?? null;
  const operators = options?.issued_by ?? [];
  // The visitor filter payload carries no project or gate list, unlike the
  // vehicle one — the token's own scope is what stands in for it here.
  const filterProjects = projects ?? [];

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'vehicle_number',
        header: 'Vehicle number',
        render: (row) => (
          <div>
            <span className="font-mono font-medium text-gray-900">
              {row.vehicle_number}
            </span>
            {row.vehicle_model && (
              <p className="text-xs text-gray-400">{row.vehicle_model}</p>
            )}
          </div>
        ),
      },
      {
        key: 'name',
        header: 'Visitor',
        render: (row) => (
          <div>
            <span className="text-gray-900">{row.name}</span>
            {row.phone_number && (
              <p className="whitespace-nowrap text-xs text-gray-400">
                {row.phone_number}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'host',
        header: 'Host',
        // The point of the record: a resident or tenant is accountable for this
        // vehicle being on site. The details are stored on the pass, so they
        // survive the host's own registration being renamed or deleted.
        render: (row) => (
          <div>
            <span className="text-gray-900">{row.host?.name || '—'}</span>
            <p className="whitespace-nowrap text-xs text-gray-400">
              {[row.host?.unit_number, row.host?.type].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        ),
      },
      {
        key: 'purpose',
        header: 'Purpose',
        render: (row) => row.purpose || <span className="text-gray-400">—</span>,
      },
      { key: 'status', header: 'Status', render: (row) => <StatusCell row={row} /> },
      {
        key: 'is_active',
        header: 'Allowed',
        // The switch is the state itself, not something done to the row: Status
        // shows the outcome (which also depends on the window), this shows the
        // one half a person controls.
        render: (row) => (
          <Switch
            checked={row.is_active}
            disabled={!canWrite || busyId === row.id}
            onChange={canWrite ? () => handleToggleStatus(row) : undefined}
            labels={null}
            title={
              !canWrite
                ? row.is_active
                  ? 'Allowed'
                  : 'Revoked'
                : row.is_active
                  ? `Revoke ${row.vehicle_number} — reads as unregistered at every gate immediately`
                  : `Reinstate ${row.vehicle_number}${
                      row.inactive_reason === 'expired' || row.minutes_remaining < 0
                        ? ' — note its window has closed, so it stays unregistered until extended'
                        : ' — good again for whatever is left of its window'
                    }`
            }
          />
        ),
      },
      { key: 'window', header: 'Window', render: (row) => <WindowCell row={row} /> },
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
        key: 'issued_by',
        header: 'Issued by',
        render: (row) => (
          <span
            className="whitespace-nowrap"
            title={
              row.updated_by?.name ? `Last edited by ${row.updated_by.name}` : undefined
            }
          >
            {row.issued_by?.name || <span className="text-gray-400">—</span>}
          </span>
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
              onClick={() => setModal({ open: true, visitor: row })}
              disabled={busyId === row.id}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(row)}
              disabled={busyId === row.id}
              className="rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              title="Delete pass"
              aria-label="Delete pass"
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
          <h1 className="text-2xl font-bold text-gray-900">Visitors</h1>
          <p className="mt-1 text-sm text-gray-500">
            A pass lets one plate in for a stated window, on a resident&apos;s or
            tenant&apos;s behalf — after it closes the same plate reads as
            unregistered again
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setModal({ open: true, visitor: null })}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Issue pass
          </button>
        )}
      </div>

      {/* Each number comes from GET /api/visitors/filters and the chip opens
          exactly the rows it counts, so the two can never disagree. */}
      {!counts ? (
        <ChipsSkeleton count={5} />
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            const active = activeChip === chip.key;
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
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setActiveChip('');
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
            placeholder="Plate, visitor, host or unit"
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

        {/* The manual switch on its own, so a revoked pass is separable from one
            that merely ran out. */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Switch</span>
          <select
            value={draft.is_active}
            onChange={(e) => updateDraft('is_active', e.target.value)}
            className={inputClass}
          >
            <option value="">Any</option>
            <option value="true">Allowed</option>
            <option value="false">Revoked</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Gate</span>
          <input
            type="text"
            value={draft.device_name}
            onChange={(e) => updateDraft('device_name', e.target.value)}
            placeholder="Any gate"
            maxLength={50}
            className={inputClass}
          />
        </label>

        {operators.length > 0 && (
          <label className="flex flex-col">
            <span className="mb-1 text-xs font-medium text-gray-500">Issued by</span>
            <select
              value={draft.issued_by}
              onChange={(e) => updateDraft('issued_by', e.target.value)}
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

        {/* An overlap test, not containment: a pass running 10:00–18:00 is part
            of the afternoon even though it did not start in it. */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Active from</span>
          <input
            type="date"
            value={draft.from ? String(draft.from).slice(0, 10) : ''}
            onChange={(e) => updateDraft('from', e.target.value)}
            max={draft.to ? String(draft.to).slice(0, 10) : undefined}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Active to</span>
          <input
            type="date"
            value={draft.to ? String(draft.to).slice(0, 10) : ''}
            onChange={(e) => updateDraft('to', e.target.value)}
            min={draft.from ? String(draft.from).slice(0, 10) : undefined}
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
            setActiveChip('total');
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
        data={visitors}
        loading={loading}
        failed={!!error}
        rowKey={(row, i) => row.id ?? i}
        emptyMessage="No visitor passes match these filters"
      />

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-gray-500">
          {/* A failed read has no count to report — "No results" would be
              an answer nothing came back with. */}
          {error
            ? '—'
            : total === 0
              ? 'No results'
            : `Showing ${startIndex}–${endIndex} of ${total} pass${total === 1 ? '' : 'es'}`}
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

      <VisitorFormModal
        open={modal.open}
        visitor={modal.visitor}
        onClose={() => setModal({ open: false, visitor: null })}
        projects={projects}
        requireProject={requireProject}
        onSubmit={modal.visitor ? handleUpdate : handleCreate}
      />
    </div>
  );
}
