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

/**
 * Filter bar for the Logs page. The fields mirror GET /api/logs exactly — every
 * one is optional, and an empty bar is the default view (the caller's most
 * recent detections, newest first).
 *
 * Props:
 *  - initial:  optional initial filter values
 *  - projects: [{ group_id, project_name }] the caller can see. The project
 *              selector is hidden when there is nothing to choose between.
 *  - onSearch: (filters) => void   called on Search
 *  - onClear:  () => void          called on Clear
 */
export default function Filters({
  initial = EMPTY_LOG_FILTERS,
  projects = [],
  onSearch,
  onClear,
}) {
  const [filters, setFilters] = useState({ ...EMPTY_LOG_FILTERS, ...initial });

  const update = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

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
    <form
      onSubmit={handleSubmit}
      className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {showProjects && (
        <div className="flex flex-col">
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

      <div className="flex flex-col">
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

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">
          Vehicle type
        </label>
        <select
          value={filters.vehicle_type}
          onChange={(e) => update('vehicle_type', e.target.value)}
          className={inputClass}
        >
          <option value="">All</option>
          <option value="registered">Registered</option>
          <option value="unregistered">Unregistered</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">Gate</label>
        <input
          type="text"
          placeholder="e.g. entry1"
          value={filters.device_name}
          onChange={(e) => update('device_name', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">From</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => update('from', e.target.value)}
          max={filters.to || undefined}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">To</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => update('to', e.target.value)}
          min={filters.from || undefined}
          className={inputClass}
        />
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <button
          type="submit"
          className="flex-1 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
