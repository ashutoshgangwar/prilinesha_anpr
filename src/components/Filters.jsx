// src/components/Filters.jsx
import { useState } from 'react';

const EMPTY = {
  vehicle_number: '',
  event_type: '',
  from: '',
  to: '',
};

/**
 * Filter bar for the Logs page.
 *
 * Props:
 *  - initial: optional initial filter values
 *  - onSearch: (filters) => void   called on Search
 *  - onClear: () => void           called on Clear
 */
export default function Filters({ initial = EMPTY, onSearch, onClear }) {
  const [filters, setFilters] = useState({ ...EMPTY, ...initial });

  const update = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleClear = () => {
    setFilters(EMPTY);
    onClear();
  };

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">
          Vehicle number
        </label>
        <input
          type="text"
          placeholder="e.g. MH12AB1234"
          value={filters.vehicle_number}
          onChange={(e) => update('vehicle_number', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">
          Event type
        </label>
        <select
          value={filters.event_type}
          onChange={(e) => update('event_type', e.target.value)}
          className={inputClass}
        >
          <option value="">All</option>
          <option value="entry">Entry</option>
          <option value="exit">Exit</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">From</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => update('from', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-gray-500">To</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => update('to', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex items-end gap-2">
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
