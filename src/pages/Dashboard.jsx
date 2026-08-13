// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { startOfDay, endOfDay, format } from 'date-fns';
import { fetchLogs, fetchVehicles } from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import DataTable from '../components/DataTable';
import Logo from '../components/Logo';
import { buildLogColumns } from '../components/logColumns';
import {
  LogsIcon,
  VehiclesIcon,
  DashboardIcon,
  RefreshIcon,
  ArrowRightIcon,
} from '../components/icons';

function StatCard({ title, value, icon: Icon, accent, loading, hint }) {
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

      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
          {Number(value ?? 0).toLocaleString()}
        </p>
      )}

      {/* Reserved even when empty so the four cards stay the same height. */}
      <p className="mt-1 h-4 text-xs text-gray-400">{loading ? '' : hint}</p>
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { projects, isSuperAdmin, user } = useAuth();

  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({
    totalToday: 0,
    registeredToday: 0,
    unregisteredToday: 0,
    vehicles: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentLogs, setRecentLogs] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const from = startOfDay(new Date()).toISOString();
      const to = endOfDay(new Date()).toISOString();

      // Each tile asks for a single row and reads pagination.total — the count
      // is the point, not the rows. These previously split the day by
      // event_type, which /api/logs does not accept: the param was ignored and
      // both tiles quietly showed the unfiltered total. vehicle_type is the
      // dimension the log actually carries.
      //
      // Three counts, two requests: vehicle_type is an enum of exactly
      // registered | unregistered with a default, so every row is one or the
      // other and the third number is arithmetic, not another round trip.
      const [totalRes, registeredRes, vehiclesRes] = await Promise.all([
        fetchLogs({ from, to, limit: 1 }),
        fetchLogs({ from, to, vehicle_type: 'registered', limit: 1 }),
        // limit: 1 because only the count is wanted — the default 25 would drag
        // back a page of rows nothing renders.
        fetchVehicles({ limit: 1 }),
      ]);

      setStats({
        totalToday: totalRes.total,
        registeredToday: registeredRes.total,
        unregisteredToday: Math.max(0, totalRes.total - registeredRes.total),
        vehicles: vehiclesRes.total,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load dashboard stats'));
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const { items } = await fetchLogs({ page: 1, limit: 10 });
      setRecentLogs(items);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load recent logs'));
      setRecentLogs([]);
    } finally {
      setRecentLoading(false);
    }
  }, [toast]);

  const refresh = useCallback(async () => {
    await Promise.all([loadStats(), loadRecent()]);
    setLastUpdated(new Date());
  }, [loadStats, loadRecent]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showProject = isSuperAdmin || (projects?.length ?? 0) > 1;
  const columns = useMemo(() => buildLogColumns({ showProject }), [showProject]);

  // Share-of-today lines under the two split tiles. Only meaningful once there
  // is a day to divide by — at zero detections every tile would read "0%".
  const share = (n) =>
    stats.totalToday > 0
      ? `${Math.round((n / stats.totalToday) * 100)}% of today's detections`
      : undefined;

  const busy = statsLoading || recentLoading;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* <Logo className="h-14 w-14 shrink-0 ring-1 ring-ink-100" /> */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.name ? `Welcome back, ${user.name}` : 'Dashboard'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {format(new Date(), 'EEEE, d MMMM yyyy')} · today&apos;s activity
            </p>
          </div>
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

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Detections today"
          value={stats.totalToday}
          icon={DashboardIcon}
          accent="bg-brand-50 text-brand-600"
          loading={statsLoading}
          hint="All gates, since midnight"
        />
        <StatCard
          title="Registered today"
          value={stats.registeredToday}
          icon={LogsIcon}
          accent="bg-brand-100 text-brand-700"
          loading={statsLoading}
          hint={share(stats.registeredToday)}
        />
        <StatCard
          title="Unregistered today"
          value={stats.unregisteredToday}
          icon={LogsIcon}
          accent="bg-ink-100 text-ink-500"
          loading={statsLoading}
          hint={share(stats.unregisteredToday)}
        />
        <StatCard
          title="Registered vehicles"
          value={stats.vehicles}
          icon={VehiclesIcon}
          accent="bg-brand-50 text-brand-600"
          loading={statsLoading}
          hint="On the allow-list"
        />
      </div>

      {/* Recent logs */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Recent detections
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              The last 10 reads across your projects
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

        {/* The card already draws the border and rounding this table used to. */}
        <DataTable
          columns={columns}
          data={recentLogs}
          loading={recentLoading}
          rowKey={(row, i) => row.id ?? i}
          emptyMessage="No detections yet today"
          bare
        />
      </section>
    </div>
  );
}
