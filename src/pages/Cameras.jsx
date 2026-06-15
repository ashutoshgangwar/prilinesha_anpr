// src/pages/Cameras.jsx
import { useState, useEffect, useCallback } from 'react';
import { fetchCameras, createCamera, deleteCamera } from '../api/dataService';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import DataTable from '../components/DataTable';
import { GateTypeBadge } from '../components/Badge';
import { TrashIcon } from '../components/icons';

const EMPTY_FORM = {
  cam_id: '',
  device_name: '',
  gate_type: 'entry',
  location: '',
};

export default function Cameras() {
  const toast = useToast();

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await fetchCameras();
      setCameras(items);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load cameras'));
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (form.cam_id === '' || form.cam_id === null) {
      setFormError('Camera ID is required');
      return;
    }
    if (!form.gate_type) {
      setFormError('Gate type is required');
      return;
    }
    setSubmitting(true);
    try {
      await createCamera({
        cam_id: Number(form.cam_id),
        device_name: form.device_name.trim(),
        gate_type: form.gate_type,
        location: form.location.trim(),
      });
      toast.success('Camera added');
      setForm(EMPTY_FORM);
      loadCameras();
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to add camera');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (camera) => {
    const id = camera.id ?? camera._id;
    if (
      !window.confirm(
        `Delete camera "${camera.device_name || camera.cam_id || 'unknown'}"?`
      )
    ) {
      return;
    }
    try {
      await deleteCamera(id);
      toast.success('Camera deleted');
      loadCameras();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete camera'));
    }
  };

  const columns = [
    { key: 'cam_id', header: 'Cam ID' },
    {
      key: 'device_name',
      header: 'Device Name',
      render: (row) => row.device_name || '—',
    },
    {
      key: 'gate_type',
      header: 'Gate Type',
      render: (row) => <GateTypeBadge value={row.gate_type} />,
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => row.location || '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => handleDelete(row)}
          className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
          title="Delete camera"
          aria-label="Delete camera"
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
        <h1 className="text-2xl font-bold text-gray-900">Cameras</h1>
        <p className="mt-1 text-sm text-gray-500">Gate camera configuration</p>
      </div>

      {/* Add camera form */}
      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Add camera</h2>
        {formError && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Cam ID *
            </label>
            <input
              type="number"
              value={form.cam_id}
              onChange={(e) => update('cam_id', e.target.value)}
              className={inputClass}
              placeholder="101"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Device name
            </label>
            <input
              type="text"
              value={form.device_name}
              onChange={(e) => update('device_name', e.target.value)}
              className={inputClass}
              placeholder="Main Gate Cam"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Gate type *
            </label>
            <select
              value={form.gate_type}
              onChange={(e) => update('gate_type', e.target.value)}
              className={inputClass}
            >
              <option value="entry">Entry</option>
              <option value="exit">Exit</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-500">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              className={inputClass}
              placeholder="North entrance"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Adding…' : 'Add camera'}
            </button>
          </div>
        </div>
      </form>

      <DataTable
        columns={columns}
        data={cameras}
        loading={loading}
        rowKey={(row, i) => row.id ?? row._id ?? i}
        emptyMessage="No cameras found"
      />
    </div>
  );
}
