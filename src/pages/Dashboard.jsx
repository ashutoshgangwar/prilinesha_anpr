// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  fetchAnalyticsFilters,
  fetchAnalyticsSummary,
  fetchTrafficSeries,
  fetchLogs,
} from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import { formatCount, DIRECTION_SOURCE_LABELS } from '../utils/analytics';
import DataTable from '../components/DataTable';
import Skeleton, { TableSkeletonRows } from '../components/Skeletons';
import TrafficChart from '../components/TrafficChart';
import AnalyticsFilters, {
  EMPTY_ANALYTICS_FILTERS,
} from '../components/AnalyticsFilters';
import { buildLogColumns } from '../components/logColumns';
import {
  VehiclesIcon,
  DashboardIcon,
  RefreshIcon,
  ArrowRightIcon,
  EntryIcon,
  ExitIcon,
  AlertIcon,
} from '../components/icons';

// The filters every report shares. Direction is deliberately absent from the
// detection log's own params — see loadRecent below.
const REPORT_KEYS = ['group_id', 'device_name', 'direction', 'vehicle_type', 'from', 'to'];

/** Drops empty fields, so a blank control is absent rather than sent as "". */
const toParams = (filters, keys = REPORT_KEYS) => {
  const params = {};
  for (const key of keys) {
    const value = String(filters[key] ?? '').trim();
    if (value) params[key] = value;
  }
  return params;
};

/**
 * A number tile.
 *
 * `loading` covers both "still fetching" and "the request failed", and it is
 * deliberately not possible to render this tile without a number: an absent
 * value would print as "0", and a zero that means "we could not ask" is worse
 * than no tile at all — it is a number an operator can act on.
 */
function StatCard({ title, value, icon: Icon, accent, loading, hint }) {
  const unknown = loading || value == null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>

      {unknown ? (
        <div className="mt-3">
          <Skeleton height={30} width={80} />
        </div>
      ) : (
        <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
          {formatCount(value)}
        </p>
      )}

      {/* Reserved even when empty so the four cards stay the same height. */}
      <p className="mt-1 h-4 text-xs text-gray-400">{unknown ? '' : hint}</p>
    </div>
  );
}

/** A small labelled number, for the strips that are not headline tiles. */
function Figure({ label, value, tone = 'text-gray-900' }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {value == null ? (
        <Skeleton height={20} width={44} />
      ) : (
        <p className={`text-xl font-semibold tabular-nums ${tone}`}>
          {formatCount(value)}
        </p>
      )}
    </div>
  );
}

function DirectionBadge({ direction, source }) {
  const tone =
    direction === 'entry'
      ? 'bg-brand-50 text-brand-700'
      : direction === 'exit'
        ? 'bg-orange-50 text-orange-700'
        : 'bg-gray-100 text-gray-500';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>
        {direction || 'Unattributed'}
      </span>
      <span className="text-xs text-gray-400">
        {DIRECTION_SOURCE_LABELS[source] || source}
      </span>
    </span>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { projects, isSuperAdmin, user } = useAuth();

  // What the filter bar can offer. Fetched once — it also carries the date chips
  // and the standing registry counts, so the first tiles can paint before the
  // heavier reports land.
  const [options, setOptions] = useState(null);
  const [optionsReady, setOptionsReady] = useState(false);

  const [filters, setFilters] = useState(EMPTY_ANALYTICS_FILTERS);
  const [summary, setSummary] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [recentLogs, setRecentLogs] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Only the newest request may write state: changing a filter while a slower
  // one is in flight would otherwise let stale numbers land on top.
  const requestSeq = useRef(0);

  // The reports wait for this, so the window they are asked for is the one the
  // chips resolved in the report timezone rather than one derived from the
  // browser's clock. A failure here is not fatal — the reports then run against
  // the server's own default window.
  useEffect(() => {
    let cancelled = false;

    fetchAnalyticsFilters()
      .then((data) => {
        if (cancelled) return;
        setOptions(data);

        const preferred =
          data?.quick_ranges?.find((r) => r.key === 'last_7_days') ??
          data?.quick_ranges?.[0];
        if (preferred) {
          setFilters((prev) => ({
            ...prev,
            from: preferred.from,
            to: preferred.to,
            granularity: preferred.granularity,
          }));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Degraded, not broken: the bar falls back to free choice and the
        // reports to the API's default window.
        toast.error(getErrorMessage(err, 'Could not load the filter options'));
      })
      .finally(() => {
        if (!cancelled) setOptionsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const loadReports = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');

    const params = toParams(filters);

    try {
      const [summaryData, trafficData] = await Promise.all([
        fetchAnalyticsSummary(params),
        fetchTrafficSeries({ ...params, granularity: filters.granularity }),
      ]);
      if (seq !== requestSeq.current) return;

      setSummary(summaryData);
      setTraffic(trafficData);
    } catch (err) {
      if (seq !== requestSeq.current) return;

      const status = err?.response?.status;
      // 400 here is nearly always the bucket ceiling, and the API's message
      // names the fix ("coarsen the granularity"), so it is shown as written.
      const message =
        status === 403
          ? "You don't have access to that project."
          : getErrorMessage(err, 'Failed to load the dashboard');

      setError(message);
      // Both are cleared, not left standing: numbers from the last successful
      // window would sit under an error message describing a different one, and
      // a stale tile reads exactly like a fresh one.
      setSummary(null);
      setTraffic(null);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [filters]);

  /**
   * The recent-detections table under the chart, scoped by the same filters.
   *
   * GET /api/logs has no `direction` — direction belongs to the gate, not to the
   * event — so a direction filter is applied to these rows below, at render.
   * A wider page is fetched when one is set, so the list can still fill up after
   * that narrowing.
   */
  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError('');

    const params = toParams(filters, ['group_id', 'device_name', 'vehicle_type', 'from', 'to']);

    try {
      const { items } = await fetchLogs({
        ...params,
        page: 1,
        limit: filters.direction ? 50 : 10,
      });
      setRecentLogs(items);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to load recent detections');
      setRecentError(message);
      toast.error(message);
      setRecentLogs([]);
    } finally {
      setRecentLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    if (!optionsReady) return undefined;

    let cancelled = false;
    Promise.all([loadReports(), loadRecent()]).then(() => {
      // Stamped when the numbers actually landed, not when they were asked for.
      if (!cancelled) setLastUpdated(new Date());
    });

    return () => {
      cancelled = true;
    };
  }, [optionsReady, loadReports, loadRecent]);

  const refresh = useCallback(async () => {
    await Promise.all([loadReports(), loadRecent()]);
    setLastUpdated(new Date());
  }, [loadReports, loadRecent]);

  const projectName = useCallback(
    (groupId) =>
      (options?.projects ?? projects ?? []).find((p) => p.group_id === groupId)
        ?.project_name || groupId,
    [options, projects]
  );

  const showProject = !filters.group_id && (isSuperAdmin || (projects?.length ?? 0) > 1);
  const columns = useMemo(() => buildLogColumns({ showProject }), [showProject]);

  /**
   * The rows to show under a direction filter.
   *
   * The map comes from the summary's own `by_device`, not from the project's
   * device list: a detection can name a gate nobody registered on the project,
   * and the server still resolves a direction for it from the name. Matching
   * against the registry alone would drop exactly those rows, leaving an empty
   * table under numbers that say there were detections.
   */
  const visibleLogs = useMemo(() => {
    if (!filters.direction) return recentLogs.slice(0, 10);

    const byGate = new Map(
      (summary?.by_device ?? []).map((d) => [
        `${d.group_id}::${String(d.device_name).toLowerCase()}`,
        d.direction,
      ])
    );

    return recentLogs
      .filter(
        (row) =>
          byGate.get(`${row.group_id}::${String(row.device_name).toLowerCase()}`) ===
          filters.direction
      )
      .slice(0, 10);
  }, [recentLogs, summary, filters.direction]);

  // Registry counts come with the filter payload too, so the tile has a number
  // before the summary lands rather than sitting on a skeleton.
  // The filter payload carries the standing registry counts too, so the tile can
  // paint before the heavier summary lands — but not after a failure: a number
  // left over from the last good read, sitting under an error banner, is
  // indistinguishable from a fresh one.
  const registry = error
    ? null
    : summary?.registered_vehicles ?? options?.registered_vehicles ?? null;
  const windowTraffic = summary?.traffic ?? null;
  const today = summary?.today ?? null;
  const unattributedGates = summary?.unattributed_devices ?? [];
  const byProject = summary?.by_project ?? [];
  const byDevice = summary?.by_device ?? [];
  const timezone = summary?.range?.timezone ?? options?.timezone;

  const share = (n) =>
    windowTraffic?.total > 0
      ? `${Math.round((n / windowTraffic.total) * 100)}% of the range`
      : undefined;

  const busy = loading || recentLoading;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.name ? `Welcome back, ${user.name}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {format(new Date(), 'EEEE, d MMMM yyyy')}
            {/* {timezone ? ` · reported in ${timezone}` : ''} */}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && !busy && (
            <span className="hidden text-xs text-gray-400 sm:inline">
              Updated {format(lastUpdated, 'HH:mm')}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshIcon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <AnalyticsFilters
        value={filters}
        options={options}
        fallbackProjects={projects}
        onChange={setFilters}
        onReset={() => {
          const preferred =
            options?.quick_ranges?.find((r) => r.key === 'last_7_days') ??
            options?.quick_ranges?.[0];
          setFilters({
            ...EMPTY_ANALYTICS_FILTERS,
            from: preferred?.from ?? '',
            to: preferred?.to ?? '',
            granularity: preferred?.granularity ?? 'day',
          });
        }}
        disabled={!optionsReady}
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tiles. Entries and exits lead, because they are what the gates are for.
          Registered vehicles is a standing count of the register and ignores the
          date range — the API is explicit about that, and so is the hint. */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Entries"
          value={windowTraffic?.entries}
          icon={EntryIcon}
          accent="bg-brand-50 text-brand-600"
          loading={loading && !summary}
          hint={share(windowTraffic?.entries ?? 0)}
        />
        <StatCard
          title="Exits"
          value={windowTraffic?.exits}
          icon={ExitIcon}
          accent="bg-orange-50 text-orange-600"
          loading={loading && !summary}
          hint={share(windowTraffic?.exits ?? 0)}
        />
        <StatCard
          title="Detections"
          value={windowTraffic?.total}
          icon={DashboardIcon}
          accent="bg-ink-100 text-ink-500"
          loading={loading && !summary}
          hint={
            windowTraffic
              ? `${formatCount(windowTraffic.registered)} registered · ${formatCount(
                  windowTraffic.unregistered
                )} unregistered`
              : undefined
          }
        />
        <StatCard
          title="Registered vehicles"
          value={registry?.total}
          icon={VehiclesIcon}
          accent="bg-brand-50 text-brand-600"
          loading={!registry}
          hint={
            registry
              ? `${formatCount(registry.active)} active · ${formatCount(
                  registry.expired
                )} expired · ${formatCount(registry.deactivated)} off`
              : undefined
          }
        />
      </div>

      {/* Today, whatever the range says. The summary carries it separately, so
          this needs no second call and stays right even when the range is a
          month ago. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-10 gap-y-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-gray-900">Today</p>
          {/* Without the summary there is no local day to name — and "no
              detections yet today" would be a claim nothing checked. */}
          {today?.date ? (
            <p className="text-xs text-gray-500">{today.date}</p>
          ) : (
            <Skeleton height={12} width={90} />
          )}
        </div>
        <Figure label="Entries" value={today?.entries} />
        <Figure label="Exits" value={today?.exits} />
        <Figure label="Detections" value={today?.total} />
        {(today?.unattributed ?? 0) > 0 && (
          <Figure label="Unattributed" value={today.unattributed} tone="text-gray-500" />
        )}
      </div>

      {/* Gates with no direction cost the report accuracy, so they are named
          along with the one-line fix rather than quietly under-reporting. */}
      {unattributedGates.length > 0 && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">
              {unattributedGates.length} gate{unattributedGates.length === 1 ? '' : 's'} without
              a usable direction
            </p>
            <p className="mt-1 text-amber-800">
              Their detections are counted under <em>unattributed</em> rather than guessed
              into entries or exits, so entries + exits will not add up to the total.
              {isSuperAdmin ? ' Set a direction on each gate in ' : ' Ask a super admin to set a direction on '}
              {isSuperAdmin ? (
                <Link to="/projects" className="font-medium underline">
                  Projects
                </Link>
              ) : (
                'the project'
              )}
              .
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-800">
              {unattributedGates.map((gate) => (
                <li key={`${gate.group_id}:${gate.device_name}`}>
                  <span className="font-medium">{gate.device_name}</span> ·{' '}
                  {projectName(gate.group_id)}
                  {gate.configured_direction === 'both' ? ' (set to both)' : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mb-6">
        <TrafficChart
          series={traffic?.series ?? []}
          granularity={traffic?.range?.granularity ?? filters.granularity}
          loading={loading}
          failed={!!error}
          timezone={traffic?.range?.timezone}
        />
      </div>

      {/* Breakdowns. by_project only earns its place when rows can differ. */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {(!summary || byProject.length > 1) && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">By project</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Traffic over the selected range; the register is a standing count
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">Project</th>
                    <th className="px-4 py-2.5 text-right font-medium">Entries</th>
                    <th className="px-4 py-2.5 text-right font-medium">Exits</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="px-5 py-2.5 text-right font-medium">Vehicles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!summary && <TableSkeletonRows columns={5} rows={3} />}
                  {byProject.map((row) => (
                    <tr key={row.group_id}>
                      <td className="px-5 py-2.5 text-gray-900">
                        {projectName(row.group_id)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                        {formatCount(row.traffic.entries)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                        {formatCount(row.traffic.exits)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900">
                        {formatCount(row.traffic.total)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-gray-700">
                        {formatCount(row.registered_vehicles.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">By gate</h2>
            {/* <p className="mt-0.5 text-xs text-gray-500">
              What each gate saw, and on whose authority its direction was decided
            </p> */}
          </div>
          {summary && byDevice.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">
              No detections in this range
            </p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">Gate</th>
                    {showProject && (
                      <th className="px-4 py-2.5 text-left font-medium">Project</th>
                    )}
                    <th className="px-4 py-2.5 text-left font-medium">Direction</th>
                    <th className="px-5 py-2.5 text-right font-medium">Detections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!summary && (
                    <TableSkeletonRows columns={showProject ? 4 : 3} rows={4} />
                  )}
                  {byDevice.map((row) => (
                    <tr key={`${row.group_id}:${row.device_name}`}>
                      <td className="px-5 py-2.5 font-medium text-gray-900">
                        {row.device_name}
                      </td>
                      {showProject && (
                        <td className="px-4 py-2.5 text-gray-600">
                          {projectName(row.group_id)}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <DirectionBadge
                          direction={row.direction}
                          source={row.direction_source}
                        />
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-gray-900">
                        {formatCount(row.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Recent detections */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recent detections</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              The last 10 reads matching the filters above
            </p>
          </div>
          <Link
            to="/logs"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            View all
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <DataTable
          columns={columns}
          data={visibleLogs}
          loading={recentLoading}
          failed={!!recentError}
          rowKey={(row, i) => row.id ?? i}
          emptyMessage="No detections match these filters"
          bare
        />
      </section>
    </div>
  );
}
