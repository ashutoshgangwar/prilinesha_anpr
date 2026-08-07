// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { fetchLogs, fetchVehicles } from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import DataTable from '../components/DataTable';
import { buildLogColumns } from '../components/logColumns';
import {
  LogsIcon,
  VehiclesIcon,
  DashboardIcon,
} from '../components/icons';

function StatCard({ title, value, icon: Icon, accent, loading }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">
          {loading ? '…' : value}
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { projects, isSuperAdmin } = useAuth();

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

  useEffect(() => {
    loadStats();
    loadRecent();
  }, [loadStats, loadRecent]);

  const showProject = isSuperAdmin || (projects?.length ?? 0) > 1;
  const columns = useMemo(() => buildLogColumns({ showProject }), [showProject]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Today&apos;s activity overview</p>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Detections today"
          value={stats.totalToday}
          icon={DashboardIcon}
          accent="bg-brand-50 text-brand-600"
          loading={statsLoading}
        />
        <StatCard
          title="Registered today"
          value={stats.registeredToday}
          icon={LogsIcon}
          accent="bg-blue-50 text-blue-600"
          loading={statsLoading}
        />
        <StatCard
          title="Unregistered today"
          value={stats.unregisteredToday}
          icon={LogsIcon}
          accent="bg-yellow-50 text-yellow-600"
          loading={statsLoading}
        />
        <StatCard
          title="Registered vehicles"
          value={stats.vehicles}
          icon={VehiclesIcon}
          accent="bg-blue-50 text-blue-600"
          loading={statsLoading}
        />
      </div>

      {/* Recent logs */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Recent logs</h2>
      </div>
      <DataTable
        columns={columns}
        data={recentLogs}
        loading={recentLoading}
        rowKey={(row, i) => row.id ?? i}
        emptyMessage="No detections yet"
      />
    </div>
  );
}
