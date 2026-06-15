// src/pages/Vehicles.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  fetchVehicles,
  createVehicle,
  deleteVehicle,
} from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { getErrorMessage, formatDateTime } from '../utils/format';
import DataTable from '../components/DataTable';
import { TrashIcon } from '../components/icons';

const VEHICLE_CLASSES = ['car', 'bus', 'truck', 'bike', 'auto'];

const EMPTY_FORM = {
  vehicle_number: '',
  owner_name: '',
  vehicle_class: 'car',
  notes: '',
};

export default function Vehicles() {
  const toast = useToast();

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await fetchVehicles();
      setVehicles(items);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load vehicles'));
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.vehicle_number.trim()) {
      setFormError('Vehicle number is required');
      return;
    }
    setSubmitting(true);
    try {
      await createVehicle({
        vehicle_number: form.vehicle_number.trim(),
        owner_name: form.owner_name.trim(),
        vehicle_class: form.vehicle_class,
        notes: form.notes.trim(),
      });
      toast.success('Vehicle added');
      setForm(EMPTY_FORM);
      loadVehicles();
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to add vehicle');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vehicle) => {
    const id = vehicle.id ?? vehicle._id;
    if (
      !window.confirm(
        `Delete vehicle "${vehicle.vehicle_number || 'unknown'}"?`
      )
    ) {
      return;
    }
    try {
      await deleteVehicle(id);
      toast.success('Vehicle deleted');
      loadVehicles();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete vehicle'));
    }
  };

  const columns = [
    { key: 'vehicle_number', header: 'Vehicle Number' },
    {
      key: 'owner_name',
      header: 'Owner',
      render: (row) => row.owner_name || '—',
    },
    {
      key: 'vehicle_class',
      header: 'Class',
      render: (row) => (
        <span className="capitalize">{row.vehicle_class || '—'}</span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => (
        <span className="block max-w-xs truncate" title={row.notes || ''}>
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => handleDelete(row)}
          className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
          title="Delete vehicle"
          aria-label="Delete vehicle"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      ),
    },
  ];

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
        <p className="mt-1 text-sm text-gray-500">Registered vehicles</p>
      </div>

      {/* Add vehicle form */}
      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Add vehicle</h2>
        {formError && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Vehicle number *
            </label>
            <input
              type="text"
              value={form.vehicle_number}
              onChange={(e) => update('vehicle_number', e.target.value)}
              className={inputClass}
              placeholder="MH12AB1234"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Owner name
            </label>
            <input
              type="text"
              value={form.owner_name}
              onChange={(e) => update('owner_name', e.target.value)}
              className={inputClass}
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Class
            </label>
            <select
              value={form.vehicle_class}
              onChange={(e) => update('vehicle_class', e.target.value)}
              className={inputClass}
            >
              {VEHICLE_CLASSES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Notes
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Adding…' : 'Add vehicle'}
            </button>
          </div>
        </div>
      </form>

      <DataTable
        columns={columns}
        data={vehicles}
        loading={loading}
        rowKey={(row, i) => row.id ?? row._id ?? i}
        emptyMessage="No vehicles found"
      />
    </div>
  );
}
