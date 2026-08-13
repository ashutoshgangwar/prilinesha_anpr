// src/components/AnalyticsFilters.jsx
import { useState } from 'react';
import {
  GRANULARITY_LABELS,
  fitGranularity,
  estimateBuckets,
  shiftDate,
  spanInDays,
} from '../utils/analytics';

export const EMPTY_ANALYTICS_FILTERS = {
  group_id: '',
  device_name: '',
  direction: '',
  vehicle_type: '',
  granularity: 'day',
  from: '',
  to: '',
};

const TYPE_LABELS = {
  registered: 'Registered',
  unregistered: 'Unregistered',
};

const DIRECTION_LABELS = {
  entry: 'Entries only',
  exit: 'Exits only',
};

const toDateInput = (value) => (value ? String(value).slice(0, 10) : undefined);

/**
 * The one filter row above the dashboard. Everything below it — the tiles, the
 * chart and the breakdowns — is scoped by exactly these values, so the numbers
 * can never disagree with one another.
 *
 * The date chips come from the API's `quick_ranges` and are sent back verbatim:
 * they are resolved in the report timezone server-side, which is the whole point
 * of them. Re-deriving "today" from the browser's clock is how a dashboard ends
 * up an hour or a day out for an operator in another zone.
 *
 * Props:
 *  - value:    the current filter object
 *  - options:  GET /api/analytics/filters payload, or null while it loads
 *  - onChange: (next) => void — applied immediately; there is no Search button,
 *              because a dashboard's job is to answer without being asked twice
 *  - onReset:  () => void
 */
export default function AnalyticsFilters({
  value,
  options,
  fallbackProjects = [],
  onChange,
  onReset,
  disabled = false,
}) {
  // Said only when the bar had to change something the user did not ask it to.
  const [notice, setNotice] = useState('');

  const projects = options?.projects ?? fallbackProjects;
  const quickRanges = options?.quick_ranges ?? [];
  const granularities = options?.granularities ?? ['hour', 'day', 'week', 'month'];
  const vehicleTypes = options?.vehicle_types ?? ['registered', 'unregistered'];
  const directions = options?.directions ?? ['entry', 'exit'];
  const maxBuckets = options?.limits?.max_buckets ?? 750;

  // Gates are per-project, so naming a project narrows the list to its own.
  const gates = (() => {
    const scoped = value.group_id
      ? (options?.devices ?? []).filter((d) => d.group_id === value.group_id)
      : options?.devices ?? [];

    if (scoped.length > 0) {
      const seen = new Map();
      scoped.forEach((d) => {
        if (!seen.has(d.device_name.toLowerCase())) seen.set(d.device_name.toLowerCase(), d);
      });
      return [...seen.values()].sort((a, b) => a.device_name.localeCompare(b.device_name));
    }

    // Before the payload lands (or if it failed) the project list on the token
    // has no gates on it, so the picker simply has nothing to offer yet.
    const project = projects.find((p) => p.group_id === value.group_id);
    return (project?.device_names ?? options?.device_names ?? []).map((name) => ({
      device_name: name,
      direction: null,
    }));
  })();

  const set = (patch) => onChange({ ...value, ...patch });

  const chooseRange = (range) => {
    setNotice('');
    set({ from: range.from, to: range.to, granularity: range.granularity });
  };

  // The widest window the reports can answer at all. The chart can coarsen its
  // buckets to fit, but the summary always counts in days, so its ceiling is the
  // bucket limit expressed in days — whatever the chart is bucketing by.
  const maxSpanDays = maxBuckets;

  /**
   * A hand-picked date can widen the window past what the API will bucket, which
   * it answers with a 400. Coarsening the granularity — and, past the day
   * ceiling, pulling the other end in — means the user gets a chart instead of
   * an error to translate. The shortening is said out loud rather than done
   * quietly, since it changes what the numbers cover.
   */
  const setDate = (key, date) => {
    const next = { ...value, [key]: date };
    let note = '';

    if (spanInDays(next.from, next.to) > maxSpanDays) {
      // Move the end the user did not just touch.
      if (key === 'from') next.to = shiftDate(next.from, maxSpanDays - 1);
      else next.from = shiftDate(next.to, -(maxSpanDays - 1));

      note = `The reports cover at most ${maxSpanDays} days, so ${
        key === 'from' ? 'To' : 'From'
      } moved to ${key === 'from' ? next.to : next.from}.`;
    }

    setNotice(note);
    onChange({
      ...next,
      granularity: fitGranularity(next.from, next.to, next.granularity, maxBuckets),
    });
  };

  const activeRange = quickRanges.find(
    (r) => r.from === value.from && r.to === value.to && r.granularity === value.granularity
  );

  // The real extent of the data, so a picker cannot offer a day that could not
  // hold a detection — narrowed further to the window the reports can cover, so
  // the ceiling is a date the calendar will not offer rather than a 400.
  const dataMin = toDateInput(options?.detected_between?.from);
  const dataMax = toDateInput(options?.detected_between?.to);

  const laterOf = (a, b) => (a && b ? (a > b ? a : b) : a || b);
  const earlierOf = (a, b) => (a && b ? (a < b ? a : b) : a || b);

  const fromMin = laterOf(dataMin, value.to ? shiftDate(value.to, -(maxSpanDays - 1)) : null);
  const toMax = earlierOf(dataMax, value.from ? shiftDate(value.from, maxSpanDays - 1) : null);

  // The granularities that would not blow the bucket ceiling for this window.
  const allowedGranularity = (g) => {
    const buckets = estimateBuckets(value.from, value.to, g);
    return buckets == null || buckets <= maxBuckets;
  };

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400';

  const showProjects = projects.length > 1;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Date range first — it is the control every reader reaches for. */}
      <div className="flex flex-wrap items-center gap-2">
        {quickRanges.map((range) => {
          const active = activeRange?.key === range.key;
          return (
            <button
              key={range.key}
              type="button"
              disabled={disabled}
              onClick={() => chooseRange(range)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {showProjects && (
          <div className="flex min-w-[10rem] flex-1 flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">Project</label>
            <select
              value={value.group_id}
              disabled={disabled}
              onChange={(e) => {
                // A gate belongs to one project, so switching project must not
                // strand a gate that would then silently match nothing.
                const groupId = e.target.value;
                const stillThere = (options?.devices ?? []).some(
                  (d) =>
                    (!groupId || d.group_id === groupId) &&
                    d.device_name.toLowerCase() === value.device_name.toLowerCase()
                );
                set({ group_id: groupId, device_name: stillThere ? value.device_name : '' });
              }}
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

        <div className="flex min-w-[9rem] flex-1 flex-col">
          <label className="mb-1 text-xs font-medium text-gray-500">Gate</label>
          <select
            value={value.device_name}
            disabled={disabled}
            onChange={(e) => set({ device_name: e.target.value })}
            className={inputClass}
          >
            <option value="">All gates</option>
            {gates.map((gate) => (
              <option key={`${gate.group_id ?? ''}:${gate.device_name}`} value={gate.device_name}>
                {gate.device_name}
                {gate.direction ? ` · ${gate.direction}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[9rem] flex-1 flex-col">
          <label className="mb-1 text-xs font-medium text-gray-500">Direction</label>
          <select
            value={value.direction}
            disabled={disabled}
            onChange={(e) => set({ direction: e.target.value })}
            className={inputClass}
          >
            <option value="">Both directions</option>
            {directions.map((d) => (
              <option key={d} value={d}>
                {DIRECTION_LABELS[d] || d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[9rem] flex-1 flex-col">
          <label className="mb-1 text-xs font-medium text-gray-500">Vehicle type</label>
          <select
            value={value.vehicle_type}
            disabled={disabled}
            onChange={(e) => set({ vehicle_type: e.target.value })}
            className={inputClass}
          >
            <option value="">All vehicles</option>
            {vehicleTypes.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type] || type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[8.75rem] flex-1 flex-col">
          <label className="mb-1 text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={value.from}
            disabled={disabled}
            onChange={(e) => setDate('from', e.target.value)}
            min={fromMin}
            max={value.to || dataMax}
            className={inputClass}
          />
        </div>

        <div className="flex min-w-[8.75rem] flex-1 flex-col">
          <label className="mb-1 text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={value.to}
            disabled={disabled}
            onChange={(e) => setDate('to', e.target.value)}
            min={value.from || dataMin}
            max={toMax}
            className={inputClass}
          />
        </div>

        <div className="flex min-w-[8rem] flex-1 flex-col">
          <label className="mb-1 text-xs font-medium text-gray-500">Bucket</label>
          <select
            value={value.granularity}
            disabled={disabled}
            onChange={(e) => set({ granularity: e.target.value })}
            className={inputClass}
          >
            {granularities.map((g) => (
              <option key={g} value={g} disabled={!allowedGranularity(g)}>
                {GRANULARITY_LABELS[g] || g}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setNotice('');
            onReset();
          }}
          disabled={disabled}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset
        </button>
      </div>

      {notice && <p className="mt-3 text-xs text-amber-700">{notice}</p>}
    </div>
  );
}
