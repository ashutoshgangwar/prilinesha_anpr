// src/pages/Projects.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  addProjectDevice,
  removeProjectDevice,
} from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { getErrorMessage, formatDateTime, normalizePagination } from '../utils/format';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Switch from '../components/Switch';
import ProjectFormModal from '../components/ProjectFormModal';
import { TrashIcon } from '../components/icons';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = { search: '', is_active: '' };

/**
 * Shown once, immediately after a project is created.
 *
 * The server stores only a hash of the key, so this is the single moment it can
 * ever be read. It gets its own blocking dialog rather than a toast for exactly
 * that reason — a toast that auto-dismisses would take the key with it.
 */
function ApiKeyModal({ open, result, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;

  const { project, apiKey, intoziSetup, warning, login } = result;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`${project?.group_id} created`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          I've stored the key
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {warning || 'Store this api_key now — it is shown once and cannot be retrieved later.'}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Intozi API key
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100">
              {apiKey}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {login && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Customer login</p>
            <dl className="rounded-md border border-gray-200 text-xs">
              {[
                ['Username', login.email],
                // Only present when the server generated it — a password you
                // supplied is not echoed back.
                ['Password', login.password || `(${login.password_set})`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0"
                >
                  <dt className="w-40 shrink-0 text-gray-500">{label}</dt>
                  <dd className="break-all font-mono text-gray-800">{value}</dd>
                </div>
              ))}
            </dl>
            {login.note && <p className="mt-1 text-xs text-gray-500">{login.note}</p>}
          </div>
        )}

        {intoziSetup && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Camera setup</p>
            <dl className="rounded-md border border-gray-200 text-xs">
              {[
                ['group_id', intoziSetup.group_id],
                ['Post events to', intoziSetup.post_url],
                ['Poll feed from', intoziSetup.feed_url],
                ['Authorization header', intoziSetup.authorization_header],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0"
                >
                  <dt className="w-40 shrink-0 text-gray-500">{label}</dt>
                  <dd className="break-all font-mono text-gray-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </Modal>
  );
}

const DIRECTIONS = ['entry', 'exit', 'both'];
const DEVICE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,49}$/;

/**
 * Project detail: gates and live counts, from GET /api/projects/:group_id.
 *
 * Gates are added and removed one at a time here rather than by rewriting the
 * list, matching the API — so adding one can never silently drop another, and
 * the server keeps its own guards (no duplicates, at most 50, never the last).
 */
function ProjectDetailModal({ open, groupId, onClose, onProjectChanged }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newGate, setNewGate] = useState({ device_name: '', direction: '' });
  const [gateError, setGateError] = useState('');
  const [savingGate, setSavingGate] = useState(false);
  const [removingGate, setRemovingGate] = useState(null);

  useEffect(() => {
    if (!open || !groupId) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    setProject(null);
    setNewGate({ device_name: '', direction: '' });
    setGateError('');
    fetchProject(groupId)
      .then((p) => active && setProject(p))
      .catch((err) => active && setError(getErrorMessage(err, 'Failed to load project')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, groupId]);

  /** Both add and remove return the whole project, so state swaps wholesale. */
  const applyProject = (updated) => {
    if (!updated) return;
    setProject((prev) => ({ ...prev, ...updated }));
    onProjectChanged?.(updated);
  };

  const messageFor = (err, fallback) =>
    err?.response?.data?.errors?.[0]?.message ||
    err?.response?.data?.message ||
    err?.message ||
    fallback;

  const handleAddGate = async (e) => {
    e.preventDefault();
    setGateError('');

    const name = newGate.device_name.trim();
    if (!name) return setGateError('Gate name is required');
    if (!DEVICE_NAME_RE.test(name))
      return setGateError(
        'Letters, digits, spaces, dots, underscores or hyphens; up to 50 characters'
      );
    if (project?.devices?.some((d) => d.device_name.toLowerCase() === name.toLowerCase()))
      return setGateError(`"${name}" is already a gate on this project`);

    setSavingGate(true);
    try {
      const payload = { device_name: name };
      if (newGate.direction) payload.direction = newGate.direction;
      applyProject(await addProjectDevice(groupId, payload));
      setNewGate({ device_name: '', direction: '' });
    } catch (err) {
      // 409 covers both "already exists" and "already holds 50".
      setGateError(messageFor(err, 'Failed to add gate'));
    } finally {
      setSavingGate(false);
    }
  };

  const handleRemoveGate = async (device) => {
    if (
      !window.confirm(
        `Remove the gate "${device.device_name}"?\n\nDetections already recorded from it are unaffected.`
      )
    ) {
      return;
    }
    setGateError('');
    setRemovingGate(device.device_name);
    try {
      applyProject(await removeProjectDevice(groupId, device.device_name));
    } catch (err) {
      // 409 when it is the project's last gate.
      setGateError(messageFor(err, 'Failed to remove gate'));
    } finally {
      setRemovingGate(null);
    }
  };

  const gates = project?.devices ?? [];

  return (
    <Modal open={open} title={groupId || 'Project'} onClose={onClose}>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {project && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Registered vehicles', project.stats?.registered_vehicles],
              ['Detections', project.stats?.total_events],
              ['Assigned users', project.stats?.assigned_users],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value ?? '—'}</p>
              </div>
            ))}
          </div>

          <dl className="space-y-2">
            {[
              ['Address', project.address],
              ['Type', project.project_type],
              ['Customer', project.customer_name],
              ['Contact', [project.contact_email, project.contact_phone].filter(Boolean).join(' · ')],
              ['Description', project.description],
              ['API key', project.api_key_last4 ? `••••${project.api_key_last4}` : null],
              ['Key rotated', project.api_key_rotated_at ? formatDateTime(project.api_key_rotated_at) : null],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-gray-500">{label}</dt>
                  <dd className="capitalize text-gray-800">{value}</dd>
                </div>
              ))}
          </dl>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">
              Gates ({gates.length})
            </p>

            {gates.length ? (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {gates.map((d) => (
                  <li
                    key={d.device_name}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800">
                      {d.device_name}
                    </span>
                    {d.direction && (
                      <Badge
                        color={
                          d.direction === 'entry'
                            ? 'green'
                            : d.direction === 'exit'
                              ? 'red'
                              : 'gray'
                        }
                      >
                        {d.direction}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveGate(d)}
                      // The last gate cannot go: a project with no gates could
                      // never receive a detection. The server enforces it too.
                      disabled={gates.length <= 1 || removingGate === d.device_name}
                      title={
                        gates.length <= 1
                          ? 'A project must keep at least one gate'
                          : `Remove ${d.device_name}`
                      }
                      className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                      aria-label={`Remove ${d.device_name}`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">No gates configured.</p>
            )}

            {/* Add a gate. Kept next to the list so the names already taken are
                visible while typing a new one. */}
            <form onSubmit={handleAddGate} className="mt-2 flex flex-wrap items-start gap-2">
              <input
                type="text"
                value={newGate.device_name}
                onChange={(e) => {
                  setNewGate((g) => ({ ...g, device_name: e.target.value }));
                  setGateError('');
                }}
                placeholder="New gate name, e.g. Netru Pro Exit"
                maxLength={50}
                disabled={gates.length >= 50}
                className={`min-w-[12rem] flex-1 rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 disabled:bg-gray-50 ${
                  gateError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
                }`}
              />
              <select
                value={newGate.direction}
                onChange={(e) => setNewGate((g) => ({ ...g, direction: e.target.value }))}
                disabled={gates.length >= 50}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
              >
                <option value="">Direction…</option>
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d} className="capitalize">
                    {d}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={savingGate || gates.length >= 50}
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingGate ? 'Adding…' : 'Add gate'}
              </button>
            </form>

            {gateError && <p className="mt-1 text-xs text-red-600">{gateError}</p>}
            {gates.length >= 50 && (
              <p className="mt-1 text-xs text-gray-400">
                This project holds the maximum of 50 gates.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Projects() {
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [pageInfo, setPageInfo] = useState(
    normalizePagination(null, { page: 1, limit: PAGE_SIZE, total: 0 })
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formModal, setFormModal] = useState({ open: false, project: null });
  const [keyResult, setKeyResult] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const requestSeq = useRef(0);

  const loadProjects = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.is_active !== '') params.is_active = filters.is_active === 'true';

      const { items, total, pagination } = await fetchProjects(params);
      if (seq !== requestSeq.current) return;
      setProjects(items);
      setPageInfo(normalizePagination(pagination, { page, limit: PAGE_SIZE, total }));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const status = err?.response?.status;
      const message =
        status === 403
          ? 'Projects are visible to super admins only.'
          : getErrorMessage(err, 'Failed to load projects');
      setError(message);
      toast.error(message);
      setProjects([]);
      setPageInfo(normalizePagination(null, { page, limit: PAGE_SIZE, total: 0 }));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, filters, toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const replaceRow = (updated) =>
    setProjects((prev) => prev.map((p) => (p.group_id === updated.group_id ? updated : p)));

  const handleCreate = async (payload) => {
    const result = await createProject(payload);
    setFormModal({ open: false, project: null });
    // The key dialog takes over from here — it must be dismissed deliberately.
    setKeyResult(result);
    if (page === 1) loadProjects();
    else setPage(1);
  };

  /**
   * An edit can carry both field changes and new gates, which are different
   * endpoints. They run in sequence so a gate that clashes surfaces on its own
   * rather than hiding a PATCH that already succeeded.
   */
  const handleUpdate = async ({ patch, devices }) => {
    const groupId = formModal.project.group_id;
    let updated = null;

    if (Object.keys(patch).length) {
      updated = await updateProject(groupId, patch);
    }
    for (const device_name of devices) {
      updated = await addProjectDevice(groupId, { device_name });
    }

    toast.success(
      devices.length
        ? `${groupId} updated — ${devices.length} gate${devices.length === 1 ? '' : 's'} added`
        : `${groupId} updated`
    );
    setFormModal({ open: false, project: null });
    if (updated?.group_id) replaceRow(updated);
    else loadProjects();
  };

  const handleToggleActive = async (row) => {
    const next = !row.is_active;
    setBusyId(row.group_id);
    try {
      const updated = await updateProject(row.group_id, { is_active: next });
      if (updated?.group_id) replaceRow(updated);
      else loadProjects();
      toast.success(`${row.group_id} ${next ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to change status'));
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'group_id',
        header: 'Project ID',
        render: (row) => (
          <button
            onClick={() => setDetailId(row.group_id)}
            className="font-mono font-medium text-brand-600 hover:underline"
            title="View gates and counts"
          >
            {row.group_id}
          </button>
        ),
      },
      { key: 'project_name', header: 'Name', render: (row) => row.project_name || '—' },
      {
        key: 'project_type',
        header: 'Type',
        render: (row) => <span className="capitalize">{row.project_type || '—'}</span>,
      },
      {
        key: 'address',
        header: 'Address',
        render: (row) => (
          <span className="block max-w-xs truncate" title={row.address || ''}>
            {row.address || '—'}
          </span>
        ),
      },
      {
        key: 'device_count',
        header: 'Gates',
        render: (row) => row.device_count ?? row.devices?.length ?? 0,
      },
      // No API key column: the key is shown once at creation and nowhere else.
      {
        key: 'is_active',
        header: 'Active',
        render: (row) => (
          <Switch
            checked={row.is_active}
            disabled={busyId === row.group_id}
            labels={null}
            onChange={() => handleToggleActive(row)}
            title={
              row.is_active
                ? `Deactivate ${row.group_id}`
                : `Activate ${row.group_id}`
            }
          />
        ),
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => (
          <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <button
            onClick={() => setFormModal({ open: true, project: row })}
            disabled={busyId === row.group_id}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Edit
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId]
  );

  const { total, totalPages, hasNext, hasPrevious } = pageInfo;
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, total);

  const inputClass =
    'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sites and their gates — the project ID is what the cameras send with
            every detection
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormModal({ open: true, project: null })}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          New project
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setFilters(draft);
        }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Search</span>
          <input
            type="text"
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            placeholder="ID, name or address"
            maxLength={100}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-500">Active</span>
          <select
            value={draft.is_active}
            onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.value }))}
            className={inputClass}
          >
            <option value="">Any</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
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
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
        data={projects}
        loading={loading}
        rowKey={(row, i) => row.group_id ?? i}
        emptyMessage="No projects match these filters"
      />

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-gray-500">
          {total === 0
            ? 'No results'
            : `Showing ${startIndex}–${endIndex} of ${total} project${total === 1 ? '' : 's'}`}
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

      <ProjectFormModal
        open={formModal.open}
        project={formModal.project}
        onClose={() => setFormModal({ open: false, project: null })}
        onSubmit={formModal.project ? handleUpdate : handleCreate}
      />

      <ApiKeyModal
        open={!!keyResult}
        result={keyResult}
        onClose={() => setKeyResult(null)}
      />

      <ProjectDetailModal
        open={!!detailId}
        groupId={detailId}
        onClose={() => setDetailId(null)}
        // Adding or removing a gate changes device_count, which the table
        // behind the dialog is showing.
        onProjectChanged={replaceRow}
      />
    </div>
  );
}
