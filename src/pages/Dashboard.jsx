// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { fetchLogs, fetchVehicles, deleteLog } from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import DataTable from '../components/DataTable';
import LogImageModal from '../components/LogImageModal';
import { buildLogColumns } from '../components/logColumns';
import {
  LogsIcon,
  VehiclesIcon,
  DashboardIcon,
  CamerasIcon,
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

  const [stats, setStats] = useState({
    totalToday: 0,
    entryToday: 0,
    exitToday: 0,
    vehicles: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentLogs, setRecentLogs] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [modalLogId, setModalLogId] = useState(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const from = startOfDay(new Date()).toISOString();
      const to = endOfDay(new Date()).toISOString();

      const [totalRes, entryRes, exitRes, vehiclesRes] = await Promise.all([
        fetchLogs({ from, to, limit: 1 }),
        fetchLogs({ from, to, event_type: 'entry', limit: 1 }),
        fetchLogs({ from, to, event_type: 'exit', limit: 1 }),
        fetchVehicles(),
      ]);

      setStats({
        totalToday: totalRes.total,
        entryToday: entryRes.total,
        exitToday: exitRes.total,
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

  const handleDelete = async (log) => {
    const id = log.id ?? log._id;
    if (!window.confirm(`Delete log for "${log.vehicle_number || 'unknown'}"?`)) {
      return;
    }
    try {
      await deleteLog(id);
      toast.success('Log deleted');
      loadRecent();
      loadStats();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete log'));
    }
  };

  const columns = buildLogColumns({
    onView: (log) => setModalLogId(log.id ?? log._id),
    onDelete: handleDelete,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Today&apos;s activity overview</p>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total logs today"
          value={stats.totalToday}
          icon={DashboardIcon}
          accent="bg-brand-50 text-brand-600"
          loading={statsLoading}
        />
        <StatCard
          title="Entry events today"
          value={stats.entryToday}
          icon={LogsIcon}
          accent="bg-green-50 text-green-600"
          loading={statsLoading}
        />
        <StatCard
          title="Exit events today"
          value={stats.exitToday}
          icon={CamerasIcon}
          accent="bg-red-50 text-red-600"
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
        rowKey={(row, i) => row.id ?? row._id ?? i}
        emptyMessage="No logs found"
      />

      <LogImageModal logId={modalLogId} onClose={() => setModalLogId(null)} />
    </div>
  );
}
