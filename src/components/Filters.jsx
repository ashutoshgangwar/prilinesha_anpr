// src/components/Filters.jsx
import { useState } from 'react';

export const EMPTY_LOG_FILTERS = {
  group_id: '',
  search: '',
  vehicle_type: '',
  device_name: '',
  from: '',
  to: '',
};

/** An ISO instant down to the yyyy-mm-dd a <input type="date"> understands. */
const toDateInput = (value) => (value ? String(value).slice(0, 10) : undefined);

const TYPE_LABELS = {
  registered: 'Registered',
  unregistered: 'Unregistered',
};

/**
 * Filter bar for the Logs page. The fields mirror GET /api/logs exactly — every
 * one is optional, and an empty bar is the default view (the caller's most
 * recent detections, newest first).
 *
 * Props:
 *  - initial:  optional initial filter values
 *  - options:  GET /api/logs/filters payload, or null while it loads / if it
 *              failed. It supplies the projects, their gates, the vehicle types
 *              and the span the detections actually cover, so nothing here is
 *              hard-coded and no dropdown can offer a project the caller would
 *              get a 403 for. Without it the gate falls back to a text box —
 *              degraded, but still usable.
 *  - onSearch: (filters) => void   called on Search
 *  - onClear:  () => void          called on Clear
 */
export default function Filters({
  initial = EMPTY_LOG_FILTERS,
  options = null,
  fallbackProjects = [],
  onSearch,
  onClear,
}) {
  const [filters, setFilters] = useState({ ...EMPTY_LOG_FILTERS, ...initial });

  // The payload's list is scoped exactly like the table; the token's own list
  // stands in until it arrives, so the selector never simply disappears.
  const projects = options?.projects ?? fallbackProjects;
  const vehicleTypes = options?.vehicle_types ?? ['registered', 'unregistered'];

  // Gates are per-project, so naming a project narrows the list to that
  // project's own. With none named, every gate in scope is offered.
  //
  // Only the /filters payload carries device_names — the project list on the
  // token does not (it is group_id, project_name and is_active alone). So this
  // must tolerate a project object with no gates on it rather than assuming the
  // richer shape, or picking a project before the payload lands is a TypeError
  // that takes the whole page down.
  const selected = projects.find((p) => p.group_id === filters.group_id);
  const gatesOf = (project) => project?.device_names ?? [];
  const gates = selected ? gatesOf(selected) : options?.device_names ?? [];

  // The real extent of the data, so the pickers cannot offer a day that could
  // not possibly hold a detection.
  const min = toDateInput(options?.detected_between?.from);
  const max = toDateInput(options?.detected_between?.to);

  const update = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Switching project can strand a gate that belongs to the old one, which
      // would then silently match nothing.
      if (key === 'group_id' && next.device_name) {
        const project = projects.find((p) => p.group_id === value);
        const available = project ? gatesOf(project) : options?.device_names ?? [];
        const stillThere = available.some(
          (g) => g.toLowerCase() === next.device_name.toLowerCase()
        );
        if (!stillThere) next.device_name = '';
      }
      return next;
    });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleClear = () => {
    setFilters(EMPTY_LOG_FILTERS);
    onClear();
  };

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  const showProjects = projects.length > 1;

  return (
    // One row of controls that share the width, rather than a fixed grid: the
    // Project selector is conditional, so a column count that suits one caller
    // strands a gap for the other. Each field keeps a min-width and only wraps
    // when the row genuinely cannot hold it.
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      {showProjects && (
        <div className="flex min-w-[9rem] flex-1 flex-col">
          <label className="mb-1 text-xs font-medium text-gray-500">Project</label>
          <select
            value={filters.group_id}
            onChange={(e) => update('group_id', e.target.value)}
            className={inputClass}
          >
            <option value="">All my projects</option>
            {projects.map((p) => (
              <option key={p.group_id} value={p.group_id}>
                {p.project_name || p.group_id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* The primary field, so it takes a double share of the spare width. */}
      <div className="flex min-w-[11rem] flex-[2] flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">Search</label>
        <input
          type="text"
          placeholder="Plate, owner or model"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          maxLength={100}
          className={inputClass}
        />
      </div>

      <div className="flex min-w-[8.5rem] flex-1 flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">
          Vehicle type
        </label>
        <select
          value={filters.vehicle_type}
          onChange={(e) => update('vehicle_type', e.target.value)}
          className={inputClass}
        >
          <option value="">All</option>
          {vehicleTypes.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type] || type}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[8.5rem] flex-1 flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">Gate</label>
        {gates.length > 0 ? (
          <select
            value={filters.device_name}
            onChange={(e) => update('device_name', e.target.value)}
            className={inputClass}
          >
            <option value="">All gates</option>
            {gates.map((gate) => (
              <option key={gate} value={gate}>
                {gate}
              </option>
            ))}
          </select>
        ) : (
          // No metadata yet (or none to offer) — a text box still works, since
          // the API matches the name case-insensitively either way.
          <input
            type="text"
            placeholder="e.g. entry1"
            value={filters.device_name}
            onChange={(e) => update('device_name', e.target.value)}
            maxLength={50}
            className={inputClass}
          />
        )}
      </div>

      <div className="flex min-w-[8.75rem] flex-1 flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">From</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => update('from', e.target.value)}
          min={min}
          max={filters.to || max}
          className={inputClass}
        />
      </div>

      <div className="flex min-w-[8.75rem] flex-1 flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">To</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => update('to', e.target.value)}
          min={filters.from || min}
          max={max}
          className={inputClass}
        />
      </div>

      {/* Sized to their labels rather than stretching, so the fields keep the
          width. They still grow to a full row of their own once wrapped. */}
      <div className="flex shrink-0 grow items-end gap-2 sm:grow-0">
        <button
          type="submit"
          className="flex-1 rounded-md bg-brand-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 sm:flex-none"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:flex-none"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
